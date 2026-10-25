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
    let callConversationId = null;

    let isCallInitiator = false;
    let isRemoteDescriptionSet = false;
    let isEndingCall = false;
    let isNegotiating = false;

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

        const otherUser = window.DMSOtherUser || {};

        const userName = $("#chatUserName").text().trim();
        const userAvatar = $("#chatUserAvatar").text().trim();

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

        const currentUser = window.DMSCallSocket.getCurrentUser();

        return currentUser && currentUser.id
            ? String(currentUser.id)
            : null;

    }


    // ==========================================
    // GET CURRENT CONVERSATION ID
    // ==========================================

    function getCurrentConversationId() {

        const urlParams = new URLSearchParams(
            window.location.search
        );

        return urlParams.get("conversation");

    }


    // ==========================================
    // SEND CALL SIGNAL
    // ==========================================

    function sendCallSignal(type, extraData, targetUserId) {

        if (
            !window.DMSCallSocket ||
            typeof window.DMSCallSocket.sendSignal !== "function"
        ) {
            console.error("Call WebSocket mövcud deyil.");
            return false;
        }

        const recipientId = targetUserId || callTargetUserId;

        if (!recipientId) {
            console.error("Zəng ediləcək istifadəçinin ID-si yoxdur.");
            return false;
        }

        if (!callConversationId) {
            console.error("Zəng üçün conversation_id yoxdur.");
            return false;
        }

        const signal = Object.assign(
            {},
            extraData || {},
            {
                type: type,
                to_user_id: Number(recipientId),
                conversation_id: Number(callConversationId)
            }
        );

        try {

            return window.DMSCallSocket.sendSignal(signal) === true;

        } catch (error) {

            console.error("Zəng siqnalı göndərilmədi:", error);

            return false;

        }

    }


    // ==========================================
    // UPDATE CALL USER
    // ==========================================

    function updateCallUser() {

        const user = getChatUser();

        $callUserName.text(user.name);
        $callUserAvatar.find("span").text(user.avatar);

    }


    // ==========================================
    // MICROPHONE BUTTON
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
    // SPEAKER BUTTON
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
    // CALL ACTIONS
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
    // CREATE REMOTE AUDIO ELEMENT
    // ==========================================

    function createRemoteAudioElement() {

        if (!remoteAudioElement) {

            remoteAudioElement = document.createElement("audio");

            remoteAudioElement.id = "dmsRemoteAudio";
            remoteAudioElement.autoplay = true;
            remoteAudioElement.playsInline = true;

            remoteAudioElement.setAttribute("autoplay", "");
            remoteAudioElement.setAttribute("playsinline", "");

            remoteAudioElement.style.display = "none";

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

            peerConnection = new RTCPeerConnection(iceServers);

        } catch (error) {

            console.error("WebRTC bağlantısı yaradıla bilmədi:", error);

            $callStatus.text("WebRTC bağlantısı yaradıla bilmədi.");

            return null;

        }

        remoteAudioStream = new MediaStream();

        createRemoteAudioElement();

        remoteAudioElement.srcObject = remoteAudioStream;


        // ======================================
        // AUDIO TRACK
        // ======================================

        peerConnection.ontrack = async function (event) {

            if (!remoteAudioElement || !event.track) {
                return;
            }

            if (event.track.kind !== "audio") {
                return;
            }

            if (event.streams && event.streams[0]) {

                remoteAudioStream = event.streams[0];

            } else {

                const existingTrack = remoteAudioStream
                    .getTracks()
                    .some(function (track) {
                        return track.id === event.track.id;
                    });

                if (!existingTrack) {
                    remoteAudioStream.addTrack(event.track);
                }

            }

            remoteAudioElement.srcObject = remoteAudioStream;
            remoteAudioElement.muted = !isSpeakerOn;

            event.track.onmute = function () {
                console.warn("Qarşı tərəfin audio treki səssizləşdi.");
            };

            event.track.onunmute = async function () {

                try {
                    await remoteAudioElement.play();
                } catch (error) {
                    console.warn("Audio başladılmadı:", error);
                }

            };

            try {

                await remoteAudioElement.play();

            } catch (error) {

                console.warn(
                    "Audio avtomatik başlamadı:",
                    error
                );

                $callStatus.text(
                    "Səsi eşitmək üçün ekrana toxunun və dinamiki yoxlayın."
                );

            }

        };


        // ======================================
        // ICE CANDIDATE
        // ======================================

        peerConnection.onicecandidate = function (event) {

            if (
                !event.candidate ||
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

        peerConnection.onconnectionstatechange = function () {

            if (!peerConnection) {
                return;
            }

            const state = peerConnection.connectionState;

            console.log("WebRTC connection state:", state);

            if (state === "connected") {

                callState = "active";

                $callStatus.text("Zəng aktivdir");

                showActiveActions();

                startCallTimer();

            } else if (state === "connecting") {

                $callStatus.text("Bağlantı yaradılır...");

            } else if (state === "disconnected") {

                $callStatus.text(
                    "Bağlantı kəsildi. Yenidən qoşulma gözlənilir..."
                );

            } else if (state === "failed") {

                $callStatus.text(
                    "Bağlantı uğursuz oldu. Şəbəkəni yoxlayın."
                );

                stopCallTimer();

            } else if (state === "closed") {

                stopCallTimer();

            }

        };


        // ======================================
        // ICE CONNECTION STATE
        // ======================================

        peerConnection.oniceconnectionstatechange = function () {

            if (!peerConnection) {
                return;
            }

            const state = peerConnection.iceConnectionState;

            console.log("WebRTC ICE state:", state);

            if (
                state === "connected" ||
                state === "completed"
            ) {

                if (
                    callState !== "idle" &&
                    callState !== "ending"
                ) {

                    callState = "active";

                    $callStatus.text("Zəng aktivdir");

                    showActiveActions();

                    startCallTimer();

                }

            } else if (state === "failed") {

                $callStatus.text(
                    "Şəbəkə bağlantısı uğursuz oldu. TURN server lazım ola bilər."
                );

                stopCallTimer();

            }

        };

        return peerConnection;

    }


    // ==========================================
    // ENSURE AUDIO TRANSCEIVER
    // ==========================================

    function ensureAudioTransceiver() {

        if (!peerConnection) {
            return null;
        }

        let audioTransceiver = peerConnection
            .getTransceivers()
            .find(function (transceiver) {

                return (
                    transceiver.receiver &&
                    transceiver.receiver.track &&
                    transceiver.receiver.track.kind === "audio"
                );

            });

        if (!audioTransceiver) {

            audioTransceiver = peerConnection.addTransceiver(
                "audio",
                {
                    direction: "sendrecv"
                }
            );

        } else if (audioTransceiver.direction !== "sendrecv") {

            audioTransceiver.direction = "sendrecv";

        }

        return audioTransceiver;

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
            callAudioStream.getAudioTracks().some(function (track) {
                return track.readyState === "live";
            })
        ) {

            callAudioStream.getAudioTracks().forEach(function (track) {
                track.enabled = true;
            });

            const existingTransceiver = ensureAudioTransceiver();

            if (
                existingTransceiver &&
                existingTransceiver.sender.track !==
                callAudioStream.getAudioTracks()[0]
            ) {

                await existingTransceiver.sender.replaceTrack(
                    callAudioStream.getAudioTracks()[0]
                );

            }

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

        const requestId = ++microphoneRequestId;

        $toggleMuteButton.prop("disabled", true);

        let stream = null;

        try {

            stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                },
                video: false
            });

            if (
                requestId !== microphoneRequestId ||
                callState === "idle" ||
                callState === "ending"
            ) {

                stream.getTracks().forEach(function (track) {
                    track.stop();
                });

                return false;

            }

            const audioTrack = stream.getAudioTracks()[0];

            if (!audioTrack) {

                stream.getTracks().forEach(function (track) {
                    track.stop();
                });

                $callStatus.text("Mikrofon audio treki əldə edilmədi.");

                return false;

            }

            if (!peerConnection && !createPeerConnection()) {

                stream.getTracks().forEach(function (track) {
                    track.stop();
                });

                return false;

            }

            const transceiver = ensureAudioTransceiver();

            if (!transceiver) {

                stream.getTracks().forEach(function (track) {
                    track.stop();
                });

                return false;

            }

            audioTrack.enabled = true;

            await transceiver.sender.replaceTrack(audioTrack);

            if (
                requestId !== microphoneRequestId ||
                callState === "idle" ||
                callState === "ending"
            ) {

                stream.getTracks().forEach(function (track) {
                    track.stop();
                });

                return false;

            }

            if (callAudioStream) {

                callAudioStream.getTracks().forEach(function (track) {
                    track.stop();
                });

            }

            callAudioStream = stream;

            isMuted = false;

            updateMicrophoneButton();

            return true;

        } catch (error) {

            if (stream) {

                stream.getTracks().forEach(function (track) {
                    track.stop();
                });

            }

            console.error("Mikrofon xətası:", error);

            isMuted = true;

            updateMicrophoneButton();

            if (
                error.name === "NotAllowedError" ||
                error.name === "PermissionDeniedError"
            ) {

                $callStatus.text("Mikrofon icazəsi verilməyib.");

            } else if (error.name === "NotFoundError") {

                $callStatus.text("Mikrofon tapılmadı.");

            } else if (error.name === "NotReadableError") {

                $callStatus.text("Mikrofon istifadə edilə bilmir.");

            } else {

                $callStatus.text(
                    "Mikrofonu aktivləşdirmək mümkün olmadı."
                );

            }

            return false;

        } finally {

            if (requestId === microphoneRequestId) {
                $toggleMuteButton.prop("disabled", false);
            }

        }

    }


    // ==========================================
    // STOP MICROPHONE
    // ==========================================

    function stopMicrophone() {

        microphoneRequestId++;

        if (peerConnection) {

            const transceiver = peerConnection
                .getTransceivers()
                .find(function (item) {

                    return (
                        item.sender &&
                        item.receiver &&
                        item.receiver.track &&
                        item.receiver.track.kind === "audio"
                    );

                });

            if (transceiver) {

                transceiver.sender.replaceTrack(null).catch(function (error) {
                    console.warn("Mikrofon treki ayrılmadı:", error);
                });

            }

        }

        if (callAudioStream) {

            callAudioStream.getTracks().forEach(function (track) {
                track.stop();
            });

            callAudioStream = null;

        }

    }


    // ==========================================
    // CREATE CALL OFFER
    // ==========================================

    async function createCallOffer() {

        if (isNegotiating) {
            return;
        }

        isNegotiating = true;

        try {

            if (!peerConnection) {
                return;
            }

            const transceiver = ensureAudioTransceiver();

            if (!transceiver) {
                throw new Error("Audio transceiver yaradılmadı.");
            }

            const offer = await peerConnection.createOffer();

            await peerConnection.setLocalDescription(offer);

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
                    "Zəng siqnalı göndərilmədi. WebSocket bağlantısını yoxlayın."
                );

            }

        } catch (error) {

            console.error("Zəng təklifi yaradılmadı:", error);

            $callStatus.text("Zəng başlatmaq mümkün olmadı.");

        } finally {

            isNegotiating = false;

        }

    }


    // ==========================================
    // OPEN CALL MODAL
    // ==========================================

    async function openCallModal() {

        if (callState !== "idle") {
            return;
        }

        const user = getChatUser();

        if (
            !user.id ||
            String(user.id) === String(getCurrentUserId())
        ) {

            alert("Zəng ediləcək istifadəçi tapılmadı.");

            return;

        }

        callConversationId = getCurrentConversationId();

        if (!callConversationId) {

            alert("Cari söhbətin ID-si tapılmadı.");

            return;

        }

        callTargetUserId = user.id;

        isCallInitiator = true;

        isRemoteDescriptionSet = false;

        pendingIceCandidates = [];

        callState = "calling";

        isMuted = true;

        isSpeakerOn = true;

        callSeconds = 0;

        stopCallTimer();

        updateCallUser();

        $callStatus.text("Mikrofon aktivləşdirilir...");

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

        if (!createPeerConnection()) {

            resetCall(false);

            return;

        }

        const microphoneEnabled = await activateMicrophone();

        if (
            !microphoneEnabled ||
            callState !== "calling"
        ) {

            $callStatus.text(
                "Mikrofon aktivləşmədi. Mikrofon icazəsini yoxlayın."
            );

            return;

        }

        $callStatus.text("Zəng edilir...");

        await createCallOffer();

    }


    // ==========================================
    // FLUSH PENDING ICE CANDIDATES
    // ==========================================

    async function flushPendingIceCandidates() {

        if (
            !peerConnection ||
            !peerConnection.remoteDescription
        ) {
            return;
        }

        while (
            pendingIceCandidates.length > 0 &&
            peerConnection &&
            peerConnection.remoteDescription
        ) {

            const candidate = pendingIceCandidates.shift();

            try {

                await peerConnection.addIceCandidate(
                    new RTCIceCandidate(candidate)
                );

            } catch (error) {

                console.warn("ICE candidate əlavə edilmədi:", error);

            }

        }

    }


    // ==========================================
    // HANDLE INCOMING CALL OFFER
    // ==========================================

    async function handleCallOffer(data) {

        const currentUserId = getCurrentUserId();

        if (
            currentUserId &&
            String(data.from_user_id) === currentUserId
        ) {
            return;
        }

        if (
            !data.description ||
            data.description.type !== "offer" ||
            !data.description.sdp ||
            !data.conversation_id
        ) {
            return;
        }

        if (callState !== "idle") {

            const previousConversationId = callConversationId;

            callConversationId = data.conversation_id;

            sendCallSignal(
                "call_busy",
                {},
                data.from_user_id
            );

            callConversationId = previousConversationId;

            return;

        }

        callTargetUserId = data.from_user_id;
        callConversationId = data.conversation_id;

        isCallInitiator = false;

        isRemoteDescriptionSet = false;

        pendingIceCandidates = [];

        callState = "incoming";

        isMuted = true;

        isSpeakerOn = true;

        callSeconds = 0;

        stopCallTimer();

        // Gələn zəngdə zəng edənin adı ayrıca server məlumatı ilə
        // əlavə edilməyibsə, burada ümumi ad göstərilir.
        $callUserName.text("Gələn zəng");
        $callUserAvatar.find("span").text("U");

        $callStatus.text("Gələn səsli zəng...");

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

        if (!createPeerConnection()) {

            resetCall(false);

            return;

        }

        try {

            await peerConnection.setRemoteDescription(
                new RTCSessionDescription(data.description)
            );

            isRemoteDescriptionSet = true;

            await flushPendingIceCandidates();

        } catch (error) {

            console.error("Gələn zəng təklifi qəbul edilmədi:", error);

            $callStatus.text("Gələn zəngin bağlantısı qurulmadı.");

        }

    }


    // ==========================================
    // ACCEPT INCOMING CALL
    // ==========================================

    async function acceptCall() {

        if (
            callState !== "incoming" ||
            !peerConnection
        ) {
            return;
        }

        $acceptCallButton.prop("disabled", true);

        try {

            $callStatus.text("Mikrofon aktivləşdirilir...");

            const microphoneEnabled = await activateMicrophone();

            if (!microphoneEnabled) {

                $callStatus.text(
                    "Mikrofon aktivləşmədi. İcazəni yoxlayın və yenidən cəhd edin."
                );

                return;

            }

            if (!peerConnection.remoteDescription) {

                $callStatus.text(
                    "Zəng təklifi hələ qəbul edilməyib."
                );

                return;

            }

            const answer = await peerConnection.createAnswer();

            await peerConnection.setLocalDescription(answer);

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
                    "Cavab göndərilmədi. WebSocket bağlantısını yoxlayın."
                );

                return;

            }

            callState = "calling";

            showActiveActions();

            $callStatus.text("Qarşı tərəfə qoşulunur...");

            await flushPendingIceCandidates();

        } catch (error) {

            console.error("Zəng qəbul edilmədi:", error);

            $callStatus.text("Zəngi qəbul etmək mümkün olmadı.");

        } finally {

            $acceptCallButton.prop("disabled", false);

        }

    }


    // ==========================================
    // HANDLE CALL ANSWER
    // ==========================================

    async function handleCallAnswer(data) {

        if (
            !peerConnection ||
            !isCallInitiator ||
            callState === "idle" ||
            callState === "ending"
        ) {
            return;
        }

        if (
            String(data.from_user_id) !==
            String(callTargetUserId)
        ) {
            return;
        }

        if (
            !data.description ||
            data.description.type !== "answer" ||
            !data.description.sdp
        ) {
            return;
        }

        try {

            await peerConnection.setRemoteDescription(
                new RTCSessionDescription(data.description)
            );

            isRemoteDescriptionSet = true;

            await flushPendingIceCandidates();

            $callStatus.text("Qarşı tərəfə qoşulunur...");

        } catch (error) {

            console.error("Zəng cavabı qəbul edilmədi:", error);

            $callStatus.text("Zəng bağlantısı qurulmadı.");

        }

    }


    // ==========================================
    // HANDLE ICE CANDIDATE
    // ==========================================

    async function handleIceCandidate(data) {

        if (
            !callTargetUserId ||
            String(data.from_user_id) !== String(callTargetUserId)
        ) {
            return;
        }

        if (!data.candidate || typeof data.candidate !== "object") {
            return;
        }

        if (
            !peerConnection ||
            !isRemoteDescriptionSet ||
            !peerConnection.remoteDescription
        ) {

            pendingIceCandidates.push(data.candidate);

            return;

        }

        try {

            await peerConnection.addIceCandidate(
                new RTCIceCandidate(data.candidate)
            );

        } catch (error) {

            console.warn("ICE candidate əlavə edilmədi:", error);

        }

    }


    // ==========================================
    // HANDLE CALL SIGNAL
    // ==========================================

    async function handleCallSignal(event) {

        const data = event.detail;

        if (!data || !data.type) {
            return;
        }

        if (data.type === "call_offer") {

            await handleCallOffer(data);

            return;

        }

        if (
            !callTargetUserId ||
            String(data.from_user_id) !== String(callTargetUserId) ||
            String(data.conversation_id) !== String(callConversationId)
        ) {
            return;
        }

        switch (data.type) {

            case "call_answer":

                await handleCallAnswer(data);

                break;

            case "ice_candidate":

                await handleIceCandidate(data);

                break;

            case "call_reject":

                $callStatus.text("Qarşı tərəf zəngi rədd etdi.");

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

        if (callState !== "incoming") {
            return;
        }

        if (callTargetUserId) {
            sendCallSignal("call_reject", {});
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
            sendCallSignal("call_end", {});
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

            const activated = await activateMicrophone();

            if (!activated) {

                isMuted = true;

                updateMicrophoneButton();

            }

            return;

        }

        isMuted = true;

        if (callAudioStream) {

            callAudioStream.getAudioTracks().forEach(function (track) {
                track.enabled = false;
            });

        }

        if (peerConnection) {

            peerConnection.getSenders().forEach(function (sender) {

                if (sender.track && sender.track.kind === "audio") {
                    sender.track.enabled = false;
                }

            });

        }

        updateMicrophoneButton();

        $callStatus.text(
            callState === "active"
                ? "Zəng aktivdir — mikrofon söndürülüb"
                : "Mikrofon söndürülüb"
        );

    }


    // ==========================================
    // TOGGLE SPEAKER
    // ==========================================

    async function toggleSpeaker() {

        if (
            callState !== "active" &&
            callState !== "calling" &&
            callState !== "incoming"
        ) {
            return;
        }

        isSpeakerOn = !isSpeakerOn;

        updateSpeakerButton();

        if (isSpeakerOn && remoteAudioElement) {

            try {

                await remoteAudioElement.play();

            } catch (error) {

                console.warn("Audio yenidən başladılmadı:", error);

                $callStatus.text(
                    "Səsi başlatmaq mümkün olmadı. Telefonun səs çıxışını yoxlayın."
                );

            }

        }

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

        callTimer = setInterval(function () {

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

            $callDuration.text(minutes + ":" + seconds);

        }, 1000);

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

            sendCallSignal("call_end", {});

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
        callConversationId = null;

        isCallInitiator = false;

        isRemoteDescriptionSet = false;

        isNegotiating = false;

        isMuted = true;

        isSpeakerOn = true;

        callSeconds = 0;

        updateMicrophoneButton();

        updateSpeakerButton();

        $toggleMuteButton.prop("disabled", false);

        $acceptCallButton.prop("disabled", false);

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

        $callStatus.text("Zəngə hazırdır");

        $("body").css("overflow", "");

        callState = "idle";

        isEndingCall = false;

    }


    // ==========================================
    // EVENT LISTENERS
    // ==========================================

    $audioCallButton.on("click", function () {

        openCallModal();

    });


    $acceptCallButton.on("click", function () {

        acceptCall();

    });


    $rejectCallButton.on("click", function () {

        rejectCall();

    });


    $endCallButton.on("click", function () {

        endCall();

    });


    $toggleMuteButton.on("click", function () {

        toggleMute();

    });


    $toggleSpeakerButton.on("click", function () {

        toggleSpeaker();

    });


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
