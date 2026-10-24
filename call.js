$(document).ready(function () {

    // ==========================================
    // CALL ELEMENTS
    // ==========================================

    const $audioCallButton = $("#audioCallButton");
    const $callModal = $("#callModal");

    const $callUserAvatar = $("#callUserAvatar");
    const $callUserName = $("#callUserName");
    const $callStatus = $("#callStatus");
    const $callDuration = $("#callDuration");

    const $callIncomingActions = $("#callIncomingActions");
    const $callActiveActions = $("#callActiveActions");

    const $acceptCallButton = $("#acceptCallButton");
    const $rejectCallButton = $("#rejectCallButton");
    const $endCallButton = $("#endCallButton");

    const $toggleMuteButton = $("#toggleMuteButton");
    const $toggleSpeakerButton = $("#toggleSpeakerButton");


    // ==========================================
    // CALL STATE
    // ==========================================

    let callState = "idle";

    let isMuted = true;
    let isSpeakerOn = true;

    let callTimer = null;
    let callSeconds = 0;

    let callAudioStream = null;
    let microphoneRequestId = 0;

    let peerConnection = null;
    let remoteAudioStream = null;
    let remoteAudioElement = null;

    let pendingIceCandidates = [];

    let callTargetUserId = null;
    let isCallInitiator = false;
    let isRemoteDescriptionSet = false;

    let isEndingCall = false;

    const iceServers = {
        iceServers: [
            {
                urls: "stun:stun.l.google.com:19302"
            }
        ]
    };


    // ==========================================
    // CURRENT CHAT USER
    // ==========================================

    function getChatUser() {

        const userName = $("#chatUserName")
            .text()
            .trim();

        const userAvatar = $("#chatUserAvatar")
            .text()
            .trim();

        const otherUser = window.DMSOtherUser || {};

        return {
            id: otherUser.id || null,
            name: userName || "İstifadəçi",
            avatar: userAvatar || "U"
        };

    }


    // ==========================================
    // GET CURRENT USER ID
    // ==========================================

    function getCurrentUserId() {

        if (
            !window.DMSCallSocket ||
            typeof window.DMSCallSocket.getCurrentUser !== "function"
        ) {
            return null;
        }

        const currentUser =
            window.DMSCallSocket.getCurrentUser();

        return currentUser && currentUser.id
            ? String(currentUser.id)
            : null;

    }


    // ==========================================
    // SEND CALL SIGNAL
    // ==========================================

    function sendCallSignal(type, extraData) {

        if (!window.DMSCallSocket) {

            console.error(
                "DMSCallSocket tapılmadı. chat.js yoxlanmalıdır."
            );

            return false;

        }

        if (
            typeof window.DMSCallSocket.sendSignal !== "function"
        ) {

            return false;

        }

        if (!callTargetUserId) {

            console.error(
                "Zəng ediləcək istifadəçinin ID-si yoxdur."
            );

            return false;

        }

        const signal = Object.assign(
            {
                type: type,
                to_user_id: Number(callTargetUserId)
            },
            extraData || {}
        );

        return window.DMSCallSocket.sendSignal(signal);

    }


    // ==========================================
    // UPDATE CALL USER
    // ==========================================

    function updateCallUser() {

        const user = getChatUser();

        $callUserName.text(user.name);

        $callUserAvatar
            .find("span")
            .text(user.avatar);

    }


    // ==========================================
    // UPDATE MICROPHONE BUTTON
    // ==========================================

    function updateMicrophoneButton() {

        $toggleMuteButton
            .toggleClass("muted", isMuted)
            .attr("aria-pressed", String(isMuted))
            .attr(
                "aria-label",
                isMuted
                    ? "Mikrofonu aktiv et"
                    : "Mikrofonu söndür"
            );

        $toggleMuteButton
            .find("i")
            .toggleClass("fa-microphone-slash", isMuted)
            .toggleClass("fa-microphone", !isMuted);

    }


    // ==========================================
    // UPDATE SPEAKER BUTTON
    // ==========================================

    function updateSpeakerButton() {

        $toggleSpeakerButton
            .toggleClass("speaker-off", !isSpeakerOn)
            .attr("aria-pressed", String(!isSpeakerOn))
            .attr(
                "aria-label",
                isSpeakerOn
                    ? "Səs çıxışını söndür"
                    : "Səs çıxışını aktivləşdir"
            );

        $toggleSpeakerButton
            .find("i")
            .toggleClass("fa-volume-high", isSpeakerOn)
            .toggleClass("fa-volume-xmark", !isSpeakerOn);

        if (remoteAudioElement) {

            remoteAudioElement.muted = !isSpeakerOn;

        }

    }


    // ==========================================
    // UPDATE CALL ACTIONS
    // ==========================================

    function showIncomingActions() {

        $callIncomingActions
            .prop("hidden", false)
            .show();

        $callActiveActions
            .prop("hidden", true)
            .hide();

    }


    function showActiveActions() {

        $callIncomingActions
            .prop("hidden", true)
            .hide();

        $callActiveActions
            .prop("hidden", false)
            .show();

    }


    // ==========================================
    // OPEN CALL MODAL
    // ==========================================

    function openCallModal() {

        if (callState !== "idle") {
            return;
        }

        const user = getChatUser();

        if (!user.id) {

            console.error(
                "Qarşı tərəfin ID-si tapılmadı. window.DMSOtherUser yoxlanmalıdır."
            );

            alert(
                "Zəng etmək mümkün olmadı: istifadəçi məlumatı tapılmadı."
            );

            return;

        }

        callTargetUserId = user.id;
        isCallInitiator = true;

        updateCallUser();

        callState = "calling";

        isMuted = true;
        isSpeakerOn = true;

        callSeconds = 0;

        stopCallTimer();

        $callStatus.text("Zəng edilir...");

        $callDuration
            .text("00:00")
            .prop("hidden", true)
            .hide();

        showActiveActions();

        $callModal
            .prop("hidden", false)
            .attr("aria-hidden", "false")
            .show();

        $("body").css("overflow", "hidden");

        updateMicrophoneButton();
        updateSpeakerButton();

        createPeerConnection();

        if (!peerConnection) {

            resetCall(false);

            return;

        }

        createCallOffer();

    }


    // ==========================================
    // CLOSE CALL MODAL
    // ==========================================

    function closeCallModal() {

        if (callState === "idle") {

            resetCall(false);

        }

    }


    // ==========================================
    // CREATE REMOTE AUDIO ELEMENT
    // ==========================================

    function createRemoteAudioElement() {

        if (!remoteAudioElement) {

            remoteAudioElement = document.createElement("audio");

            remoteAudioElement.autoplay = true;
            remoteAudioElement.playsInline = true;

            remoteAudioElement.id = "dmsRemoteAudio";

            document.body.appendChild(remoteAudioElement);

        }

        remoteAudioElement.muted = !isSpeakerOn;

        return remoteAudioElement;

    }


    // ==========================================
    // CREATE WEBRTC CONNECTION
    // ==========================================

    function createPeerConnection() {

        if (peerConnection) {

            return peerConnection;

        }

        if (!window.RTCPeerConnection) {

            $callStatus.text(
                "Bu brauzer WebRTC zənglərini dəstəkləmir."
            );

            return null;

        }

        try {

            peerConnection = new RTCPeerConnection(
                iceServers
            );

        } catch (error) {

            console.error(
                "WebRTC bağlantısı yaradıla bilmədi:",
                error
            );

            $callStatus.text(
                "WebRTC bağlantısı yaradıla bilmədi."
            );

            return null;

        }

        remoteAudioStream = new MediaStream();

        createRemoteAudioElement();

        remoteAudioElement.srcObject = remoteAudioStream;


        // ======================================
        // REMOTE AUDIO TRACK
        // ======================================

        peerConnection.ontrack = function (event) {

            const incomingStream = event.streams[0];

            if (incomingStream) {

                remoteAudioElement.srcObject =
                    incomingStream;

                remoteAudioStream = incomingStream;

            } else if (event.track) {

                remoteAudioStream.addTrack(
                    event.track
                );

                remoteAudioElement.srcObject =
                    remoteAudioStream;

            }

            remoteAudioElement.muted = !isSpeakerOn;

            remoteAudioElement.play().catch(
                function (error) {

                    console.warn(
                        "Avtomatik səs səsləndirməsi bloklandı:",
                        error
                    );

                }
            );

        };


        // ======================================
        // ICE CANDIDATE
        // ======================================

        peerConnection.onicecandidate = function (event) {

            if (!event.candidate) {
                return;
            }

            if (
                callState === "idle" ||
                callState === "ending"
            ) {
                return;
            }

            sendCallSignal(
                "ice_candidate",
                {
                    candidate: event.candidate.toJSON()
                }
            );

        };


        // ======================================
        // CONNECTION STATE
        // ======================================

        peerConnection.onconnectionstatechange =
            function () {

                if (!peerConnection) {
                    return;
                }

                const state =
                    peerConnection.connectionState;

                if (state === "connected") {

                    callState = "active";

                    $callStatus.text("Zəng aktivdir");

                    showActiveActions();

                    startCallTimer();

                    return;

                }

                if (state === "connecting") {

                    $callStatus.text(
                        "Bağlantı yaradılır..."
                    );

                    return;

                }

                if (state === "disconnected") {

                    $callStatus.text(
                        "Bağlantı kəsildi. Yenidən qoşulma gözlənilir..."
                    );

                    return;

                }

                if (state === "failed") {

                    $callStatus.text(
                        "Bağlantı qurulmadı."
                    );

                    stopCallTimer();

                }

            };


        // ======================================
        // ICE CONNECTION STATE
        // ======================================

        peerConnection.oniceconnectionstatechange =
            function () {

                if (!peerConnection) {
                    return;
                }

                const state =
                    peerConnection.iceConnectionState;

                if (
                    state === "connected" ||
                    state === "completed"
                ) {

                    if (
                        callState !== "ending" &&
                        callState !== "idle"
                    ) {

                        callState = "active";

                        $callStatus.text(
                            "Zəng aktivdir"
                        );

                        showActiveActions();

                        startCallTimer();

                    }

                }

                if (state === "failed") {

                    $callStatus.text(
                        "Şəbəkə bağlantısı uğursuz oldu."
                    );

                    stopCallTimer();

                }

            };


        return peerConnection;

    }


    // ==========================================
    // CREATE AUDIO TRANSCEIVER
    // ==========================================

    function ensureAudioTransceiver() {

        if (!peerConnection) {
            return null;
        }

        const transceivers =
            peerConnection.getTransceivers();

        let audioTransceiver =
            transceivers.find(function (transceiver) {

                return (
                    transceiver.receiver &&
                    transceiver.receiver.track &&
                    transceiver.receiver.track.kind === "audio"
                );

            });

        if (!audioTransceiver) {

            audioTransceiver =
                peerConnection.addTransceiver(
                    "audio",
                    {
                        direction: "sendrecv"
                    }
                );

        }

        return audioTransceiver;

    }


    // ==========================================
    // CREATE CALL OFFER
    // ==========================================

    async function createCallOffer() {

        try {

            if (!peerConnection) {
                return;
            }

            ensureAudioTransceiver();

            const offer =
                await peerConnection.createOffer();

            await peerConnection.setLocalDescription(
                offer
            );

            const sent = sendCallSignal(
                "call_offer",
                {
                    description: {
                        type: peerConnection.localDescription.type,
                        sdp: peerConnection.localDescription.sdp
                    }
                }
            );

            if (!sent) {

                $callStatus.text(
                    "Zəng siqnalı göndərilmədi. Bağlantını yoxlayın."
                );

            }

        } catch (error) {

            console.error(
                "Zəng təklifi yaradılmadı:",
                error
            );

            $callStatus.text(
                "Zəng başlatmaq mümkün olmadı."
            );

        }

    }


    // ==========================================
    // ACTIVATE MICROPHONE
    // ==========================================

    async function activateMicrophone() {

        if (
            callState !== "calling" &&
            callState !== "incoming" &&
            callState !== "active"
        ) {

            return false;

        }

        if (
            callAudioStream &&
            callAudioStream.getAudioTracks().some(
                function (track) {

                    return track.readyState === "live";

                }
            )
        ) {

            callAudioStream
                .getAudioTracks()
                .forEach(function (track) {

                    track.enabled = true;

                });

            isMuted = false;

            updateMicrophoneButton();

            return true;

        }

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            $callStatus.text(
                "Mikrofon üçün HTTPS və ya localhost lazımdır."
            );

            return false;

        }

        const requestId =
            ++microphoneRequestId;

        $toggleMuteButton.prop(
            "disabled",
            true
        );

        $callStatus.text(
            "Mikrofon aktivləşdirilir..."
        );

        try {

            const stream =
                await navigator.mediaDevices.getUserMedia(
                    {
                        audio: true,
                        video: false
                    }
                );

            if (
                requestId !== microphoneRequestId ||
                callState === "idle" ||
                callState === "ending"
            ) {

                stream.getTracks().forEach(
                    function (track) {

                        track.stop();

                    }
                );

                return false;

            }

            callAudioStream = stream;

            const audioTrack =
                stream.getAudioTracks()[0];

            if (!audioTrack) {

                stopMicrophone();

                $callStatus.text(
                    "Mikrofon audio treki əldə edilmədi."
                );

                return false;

            }

            audioTrack.enabled = true;

            if (!peerConnection) {

                createPeerConnection();

            }

            if (!peerConnection) {

                stopMicrophone();

                return false;

            }

            const transceiver =
                ensureAudioTransceiver();

            if (!transceiver) {

                stopMicrophone();

                return false;

            }

            await transceiver.sender.replaceTrack(
                audioTrack
            );

            if (
                requestId !== microphoneRequestId ||
                callState === "idle" ||
                callState === "ending"
            ) {

                return false;

            }

            isMuted = false;

            updateMicrophoneButton();

            /*
             * Mövcud zəng zamanı yeni mikrofon treki
             * əlavə edilirsə, bağlantının SDP-si
             * yenilənməlidir. Bu, ayrıca renegotiation
             * mərhələsində idarə olunacaq.
             */

            $callStatus.text(
                callState === "active"
                    ? "Zəng aktivdir"
                    : "Mikrofon aktivdir"
            );

            return true;

        } catch (error) {

            console.error(
                "Mikrofon xətası:",
                error
            );

            isMuted = true;

            updateMicrophoneButton();

            if (
                error.name === "NotAllowedError" ||
                error.name === "PermissionDeniedError"
            ) {

                $callStatus.text(
                    "Mikrofon icazəsi verilməyib."
                );

            } else if (
                error.name === "NotFoundError"
            ) {

                $callStatus.text(
                    "Mikrofon tapılmadı."
                );

            } else if (
                error.name === "NotReadableError"
            ) {

                $callStatus.text(
                    "Mikrofon istifadə edilə bilmir."
                );

            } else {

                $callStatus.text(
                    "Mikrofonu aktivləşdirmək mümkün olmadı."
                );

            }

            return false;

        } finally {

            if (requestId === microphoneRequestId) {

                $toggleMuteButton.prop(
                    "disabled",
                    false
                );

            }

        }

    }


    // ==========================================
    // STOP MICROPHONE
    // ==========================================

    function stopMicrophone() {

        microphoneRequestId++;

        if (callAudioStream) {

            callAudioStream
                .getTracks()
                .forEach(function (track) {

                    track.stop();

                });

            callAudioStream = null;

        }

    }


    // ==========================================
    // ADD PENDING ICE CANDIDATES
    // ==========================================

    async function flushPendingIceCandidates() {

        if (
            !peerConnection ||
            !peerConnection.remoteDescription
        ) {

            return;

        }

        while (
            pendingIceCandidates.length > 0
        ) {

            const candidate =
                pendingIceCandidates.shift();

            try {

                await peerConnection.addIceCandidate(
                    new RTCIceCandidate(candidate)
                );

            } catch (error) {

                console.warn(
                    "ICE candidate əlavə edilmədi:",
                    error
                );

            }

        }

    }


    // ==========================================
    // HANDLE INCOMING CALL OFFER
    // ==========================================

    async function handleCallOffer(data) {

        const currentUserId =
            getCurrentUserId();

        if (
            currentUserId &&
            String(data.from_user_id) === currentUserId
        ) {

            return;

        }

        if (callState !== "idle") {

            sendCallSignal(
                "call_busy",
                {}
            );

            return;

        }

        callTargetUserId = data.from_user_id;

        isCallInitiator = false;

        const otherUser =
            window.DMSOtherUser || {};

        updateCallUser();

        callState = "incoming";

        isMuted = true;
        isSpeakerOn = true;

        callSeconds = 0;

        stopCallTimer();

        $callStatus.text(
            "Gələn səsli zəng..."
        );

        $callDuration
            .text("00:00")
            .prop("hidden", true)
            .hide();

        showIncomingActions();

        $callModal
            .prop("hidden", false)
            .attr("aria-hidden", "false")
            .show();

        $("body").css("overflow", "hidden");

        updateMicrophoneButton();
        updateSpeakerButton();

        createPeerConnection();

        if (!peerConnection) {
            resetCall(false);
            return;
        }

        try {

            await peerConnection.setRemoteDescription(
                new RTCSessionDescription(
                    data.description
                )
            );

            isRemoteDescriptionSet = true;

            await flushPendingIceCandidates();

        } catch (error) {

            console.error(
                "Gələn zəng təklifi qəbul edilmədi:",
                error
            );

            $callStatus.text(
                "Gələn zəngin bağlantısı qurulmadı."
            );

        }

    }


    // ==========================================
    // ACCEPT INCOMING CALL
    // ==========================================

    async function acceptCall() {

        if (callState !== "incoming") {
            return;
        }

        if (!peerConnection) {

            createPeerConnection();

        }

        if (!peerConnection) {
            resetCall(false);
            return;
        }

        try {

            $acceptCallButton.prop(
                "disabled",
                true
            );

            $callStatus.text(
                "Zəngə qoşulunur..."
            );

            const answer =
                await peerConnection.createAnswer();

            await peerConnection.setLocalDescription(
                answer
            );

            const sent = sendCallSignal(
                "call_answer",
                {
                    description: {
                        type: peerConnection.localDescription.type,
                        sdp: peerConnection.localDescription.sdp
                    }
                }
            );

            if (!sent) {

                $callStatus.text(
                    "Cavab göndərilmədi. Bağlantını yoxlayın."
                );

                return;

            }

            callState = "calling";

            showActiveActions();

            $callStatus.text(
                "Qarşı tərəfə qoşulunur..."
            );

            await flushPendingIceCandidates();

        } catch (error) {

            console.error(
                "Zəng qəbul edilmədi:",
                error
            );

            $callStatus.text(
                "Zəngi qəbul etmək mümkün olmadı."
            );

        } finally {

            $acceptCallButton.prop(
                "disabled",
                false
            );

        }

    }


    // ==========================================
    // HANDLE CALL ANSWER
    // ==========================================

    async function handleCallAnswer(data) {

        if (
            !peerConnection ||
            !isCallInitiator ||
            callState === "idle"
        ) {

            return;

        }

        if (
            String(data.from_user_id) !==
            String(callTargetUserId)
        ) {

            return;

        }

        try {

            await peerConnection.setRemoteDescription(
                new RTCSessionDescription(
                    data.description
                )
            );

            isRemoteDescriptionSet = true;

            await flushPendingIceCandidates();

            $callStatus.text(
                "Qarşı tərəfə qoşulunur..."
            );

        } catch (error) {

            console.error(
                "Zəng cavabı qəbul edilmədi:",
                error
            );

            $callStatus.text(
                "Zəng bağlantısı qurulmadı."
            );

        }

    }


    // ==========================================
    // HANDLE ICE CANDIDATE
    // ==========================================

    async function handleIceCandidate(data) {

        if (
            String(data.from_user_id) !==
            String(callTargetUserId)
        ) {

            return;

        }

        if (!data.candidate) {
            return;
        }

        if (
            !peerConnection ||
            !isRemoteDescriptionSet
        ) {

            pendingIceCandidates.push(
                data.candidate
            );

            return;

        }

        try {

            await peerConnection.addIceCandidate(
                new RTCIceCandidate(
                    data.candidate
                )
            );

        } catch (error) {

            console.warn(
                "ICE candidate əlavə edilə bilmədi:",
                error
            );

        }

    }


    // ==========================================
    // HANDLE INCOMING CALL SIGNAL
    // ==========================================

    async function handleCallSignal(event) {

        const data = event.detail;

        if (!data || !data.type) {
            return;
        }

        if (
            data.type !== "call_offer" &&
            String(data.from_user_id) !==
            String(callTargetUserId)
        ) {

            return;

        }

        switch (data.type) {

            case "call_offer":

                await handleCallOffer(data);

                break;

            case "call_answer":

                await handleCallAnswer(data);

                break;

            case "ice_candidate":

                await handleIceCandidate(data);

                break;

            case "call_reject":

                $callStatus.text(
                    "Qarşı tərəf zəngi rədd etdi."
                );

                resetCall(false);

                break;

            case "call_end":

                $callStatus.text(
                    "Zəng qarşı tərəf tərəfindən bitirildi."
                );

                resetCall(false);

                break;

            case "call_busy":

                $callStatus.text(
                    "Qarşı tərəf hazırda başqa zəngdədir."
                );

                resetCall(false);

                break;

        }

    }


    // ==========================================
    // REJECT CALL
    // ==========================================

    function rejectCall() {

        if (
            callState !== "incoming" &&
            callState !== "calling"
        ) {

            return;

        }

        if (callTargetUserId) {

            sendCallSignal(
                "call_reject",
                {}
            );

        }

        resetCall(false);

    }


    // ==========================================
    // END CALL
    // ==========================================

    function endCall() {

        if (callState === "idle") {
            return;
        }

        if (callTargetUserId) {

            sendCallSignal(
                "call_end",
                {}
            );

        }

        resetCall(false);

    }


    // ==========================================
    // TOGGLE MICROPHONE
    // ==========================================

    async function toggleMute() {

        if (
            callState !== "active" &&
            callState !== "calling" &&
            callState !== "incoming"
        ) {

            return;

        }

        if (isMuted) {

            await activateMicrophone();

            return;

        }

        isMuted = true;

        if (callAudioStream) {

            callAudioStream
                .getAudioTracks()
                .forEach(function (track) {

                    track.enabled = false;

                });

        }

        updateMicrophoneButton();

        $callStatus.text(
            "Mikrofon söndürülüb"
        );

    }


    // ==========================================
    // TOGGLE SPEAKER
    // ==========================================

    function toggleSpeaker() {

        if (
            callState !== "active" &&
            callState !== "calling" &&
            callState !== "incoming"
        ) {

            return;

        }

        isSpeakerOn = !isSpeakerOn;

        updateSpeakerButton();

    }


    // ==========================================
    // CALL TIMER
    // ==========================================

    function startCallTimer() {

        if (callTimer !== null) {
            return;
        }

        callSeconds = 0;

        $callDuration
            .text("00:00")
            .prop("hidden", false)
            .show();

        callTimer = setInterval(
            function () {

                if (callState !== "active") {

                    stopCallTimer();

                    return;

                }

                callSeconds++;

                const minutes = String(
                    Math.floor(callSeconds / 60)
                ).padStart(2, "0");

                const seconds = String(
                    callSeconds % 60
                ).padStart(2, "0");

                $callDuration.text(
                    minutes + ":" + seconds
                );

            },
            1000
        );

    }


    // ==========================================
    // STOP CALL TIMER
    // ==========================================

    function stopCallTimer() {

        if (callTimer !== null) {

            clearInterval(callTimer);

            callTimer = null;

        }

    }


    // ==========================================
    // RESET CALL
    // ==========================================

    function resetCall(sendEndSignal) {

        if (isEndingCall) {
            return;
        }

        isEndingCall = true;

        if (
            sendEndSignal &&
            callTargetUserId
        ) {

            sendCallSignal(
                "call_end",
                {}
            );

        }

        callState = "ending";

        stopCallTimer();
        stopMicrophone();

        if (peerConnection) {

            peerConnection.ontrack = null;
            peerConnection.onicecandidate = null;
            peerConnection.onconnectionstatechange = null;
            peerConnection.oniceconnectionstatechange = null;

            peerConnection.close();

            peerConnection = null;

        }

        if (remoteAudioElement) {

            remoteAudioElement.pause();
            remoteAudioElement.srcObject = null;

            remoteAudioElement.remove();

            remoteAudioElement = null;

        }

        remoteAudioStream = null;

        pendingIceCandidates = [];

        callTargetUserId = null;

        isCallInitiator = false;
        isRemoteDescriptionSet = false;

        isMuted = true;
        isSpeakerOn = true;

        callSeconds = 0;

        updateMicrophoneButton();
        updateSpeakerButton();

        $toggleMuteButton.prop(
            "disabled",
            false
        );

        $callModal
            .prop("hidden", true)
            .attr("aria-hidden", "true")
            .hide();

        $callIncomingActions
            .prop("hidden", true)
            .hide();

        $callActiveActions
            .prop("hidden", true)
            .hide();

        $callDuration
            .text("00:00")
            .prop("hidden", true)
            .hide();

        $callStatus.text(
            "Zəngə hazırdır"
        );

        $("body").css(
            "overflow",
            ""
        );

        callState = "idle";

        isEndingCall = false;

    }


    // ==========================================
    // EVENT LISTENERS
    // ==========================================

    $audioCallButton.on(
        "click",
        function () {

            openCallModal();

        }
    );


    $acceptCallButton.on(
        "click",
        function () {

            acceptCall();

        }
    );


    $rejectCallButton.on(
        "click",
        function () {

            rejectCall();

        }
    );


    $endCallButton.on(
        "click",
        function () {

            endCall();

        }
    );


    $toggleMuteButton.on(
        "click",
        function () {

            toggleMute();

        }
    );


    $toggleSpeakerButton.on(
        "click",
        function () {

            toggleSpeaker();

        }
    );


    // ==========================================
    // RECEIVE CALL SIGNALS
    // ==========================================

    window.addEventListener(
        "dms:call-signal",
        handleCallSignal
    );


    // ==========================================
    // INITIAL STATE
    // ==========================================

    $callModal
        .prop("hidden", true)
        .attr("aria-hidden", "true")
        .hide();

    $callIncomingActions
        .prop("hidden", true)
        .hide();

    $callActiveActions
        .prop("hidden", true)
        .hide();

    $callDuration
        .prop("hidden", true)
        .hide();

    updateMicrophoneButton();
    updateSpeakerButton();

});
