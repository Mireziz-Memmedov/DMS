$(document).ready(function () {

    // ==========================================
    // CALL ELEMENTS
    // ==========================================

    const $audioCallButton = $("#audioCallButton");
    const $callModal = $("#callModal");
    const $closeCallModal = $("#closeCallModal");

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

    let isMuted = false;
    let isSpeakerOn = true;

    let callTimer = null;
    let callSeconds = 0;

    let callAudioStream = null;


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

        return {
            name: userName || "İstifadəçi",
            avatar: userAvatar || "U"
        };

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
    // OPEN CALL MODAL
    // ==========================================

    function openCallModal() {

        if (callState !== "idle") {
            return;
        }

        updateCallUser();

        callState = "calling";

        $callStatus.text("Zəng hazırlanır...");

        $callDuration
            .text("")
            .prop("hidden", true);

        $callIncomingActions.prop("hidden", true);
        $callActiveActions.prop("hidden", false);

        $callModal
            .prop("hidden", false)
            .attr("aria-hidden", "false");

        $("body").css("overflow", "hidden");

        activateMicrophone();

    }


    // ==========================================
    // CLOSE CALL MODAL
    // ==========================================

    function closeCallModal() {

        if (callState === "active") {
            return;
        }

        resetCall();

    }


    // ==========================================
    // ACTIVATE MICROPHONE
    // ==========================================

    async function activateMicrophone() {

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            $callStatus.text(
                "Mikrofon bu brauzerdə əlçatan deyil"
            );

            return;

        }

        try {

            const stream =
                await navigator.mediaDevices.getUserMedia({
                    audio: true
                });

            if (
                callState === "idle" ||
                callState === "ending"
            ) {

                stream.getTracks().forEach(function (track) {
                    track.stop();
                });

                return;

            }

            if (callAudioStream) {

                callAudioStream
                    .getTracks()
                    .forEach(function (track) {
                        track.stop();
                    });

            }

            callAudioStream = stream;

            callAudioStream
                .getAudioTracks()
                .forEach(function (track) {
                    track.enabled = !isMuted;
                });

            $callStatus.text(
                isMuted
                    ? "Mikrofon söndürülüb"
                    : "Zəng hazırlanır..."
            );

        } catch (error) {

            console.error("Mikrofon xətası:", error);

            $callStatus.text(
                "Mikrofon üçün icazə verilməyib"
            );

        }

    }


    // ==========================================
    // RESET CALL
    // ==========================================

    function resetCall() {

        callState = "ending";

        stopCallTimer();

        if (callAudioStream) {

            callAudioStream
                .getTracks()
                .forEach(function (track) {
                    track.stop();
                });

            callAudioStream = null;

        }

        callState = "idle";

        isMuted = false;
        isSpeakerOn = true;

        callSeconds = 0;

        $toggleMuteButton
            .removeClass("muted")
            .attr("aria-pressed", "false")
            .attr("aria-label", "Mikrofonu söndür")
            .find("i")
            .removeClass("fa-microphone")
            .addClass("fa-microphone-slash");

        $toggleSpeakerButton
            .removeClass("speaker-off")
            .attr("aria-pressed", "false")
            .attr("aria-label", "Səs çıxışını dəyiş")
            .find("i")
            .removeClass("fa-volume-xmark")
            .addClass("fa-volume-high");

        $callModal
            .prop("hidden", true)
            .attr("aria-hidden", "true");

        $callIncomingActions.prop("hidden", true);
        $callActiveActions.prop("hidden", true);

        $callDuration
            .text("")
            .prop("hidden", true);

        $("body").css("overflow", "");

    }


    // ==========================================
    // ACCEPT CALL
    // ==========================================

    function acceptCall() {

        if (
            callState !== "incoming" &&
            callState !== "calling"
        ) {
            return;
        }

        callState = "active";

        $callStatus.text("Zəng aktivdir");

        $callIncomingActions.prop("hidden", true);
        $callActiveActions.prop("hidden", false);

        startCallTimer();

        if (!callAudioStream) {
            activateMicrophone();
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

        resetCall();

    }


    // ==========================================
    // END CALL
    // ==========================================

    function endCall() {

        if (callState === "idle") {
            return;
        }

        resetCall();

    }


    // ==========================================
    // MUTE MICROPHONE
    // ==========================================

    function toggleMute() {

        if (
            callState !== "active" &&
            callState !== "calling"
        ) {
            return;
        }

        isMuted = !isMuted;

        if (callAudioStream) {

            callAudioStream
                .getAudioTracks()
                .forEach(function (track) {
                    track.enabled = !isMuted;
                });

        }

        $toggleMuteButton
            .toggleClass("muted", isMuted)
            .attr("aria-pressed", String(isMuted));

        $toggleMuteButton
            .find("i")
            .toggleClass("fa-microphone-slash", !isMuted)
            .toggleClass("fa-microphone", isMuted);

        $toggleMuteButton.attr(
            "aria-label",
            isMuted
                ? "Mikrofonu aktivləşdir"
                : "Mikrofonu söndür"
        );

        if (isMuted) {

            $callStatus.text("Mikrofon söndürülüb");

        } else if (callAudioStream) {

            $callStatus.text("Mikrofon aktivdir");

        } else {

            $callStatus.text("Mikrofon aktivləşdirilməyib");

        }

    }


    // ==========================================
    // TOGGLE SPEAKER
    // ==========================================

    function toggleSpeaker() {

        if (
            callState !== "active" &&
            callState !== "calling"
        ) {
            return;
        }

        isSpeakerOn = !isSpeakerOn;

        $toggleSpeakerButton
            .toggleClass("speaker-off", !isSpeakerOn)
            .attr("aria-pressed", String(!isSpeakerOn));

        $toggleSpeakerButton
            .find("i")
            .toggleClass("fa-volume-high", isSpeakerOn)
            .toggleClass("fa-volume-xmark", !isSpeakerOn);

        $toggleSpeakerButton.attr(
            "aria-label",
            isSpeakerOn
                ? "Səs çıxışını söndür"
                : "Səs çıxışını aktivləşdir"
        );

    }


    // ==========================================
    // CALL TIMER
    // ==========================================

    function startCallTimer() {

        stopCallTimer();

        callSeconds = 0;

        $callDuration
            .prop("hidden", false)
            .text("00:00");

        callTimer = setInterval(function () {

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
    // EVENT LISTENERS
    // ==========================================

    $audioCallButton.on("click", function () {

        openCallModal();

    });


    // $closeCallModal.on("click", function () {

    //     closeCallModal();

    // });


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
    // CLOSE ON BACKDROP CLICK
    // ==========================================

    // $callModal.on("click", function (event) {

    //     if (event.target === this) {
    //         closeCallModal();
    //     }

    // });


    // ==========================================
    // ESCAPE KEY
    // ==========================================

    // $(document).on("keydown", function (event) {

    //     if (event.key === "Escape") {
    //         closeCallModal();
    //     }

    // });


    // ==========================================
    // INITIAL STATE
    // ==========================================

    $callModal.prop("hidden", true);
    $callIncomingActions.prop("hidden", true);
    $callActiveActions.prop("hidden", true);

});
