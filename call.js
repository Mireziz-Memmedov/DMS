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

    isMuted = true;
    isSpeakerOn = true;

    callSeconds = 0;

    stopCallTimer();

    $callStatus.text("Zəng edilir...");

    $callDuration
        .text("00:00")
        .prop("hidden", true)
        .hide();

    $callIncomingActions.prop("hidden", true);
    $callActiveActions.prop("hidden", false);

    $callModal
        .prop("hidden", false)
        .attr("aria-hidden", "false");

    $("body").css("overflow", "hidden");

    updateMicrophoneButton();
    updateSpeakerButton();

    /*
     * Vacib:
     * Zəng başlayan zaman mikrofon açılmır.
     * Burada getUserMedia() çağırılmır.
     * Mikrofon icazəsi yalnız istifadəçi
     * mikrofon düyməsinə basanda istənilir.
     */

}


// ==========================================
// CLOSE CALL MODAL
// ==========================================

function closeCallModal() {

    if (callState !== "idle") {
        return;
    }

    resetCall();

}


// ==========================================
// ACTIVATE MICROPHONE
// ==========================================

async function activateMicrophone() {

    if (
        callState !== "calling" &&
        callState !== "active"
    ) {
        return false;
    }

    if (callAudioStream) {

        const audioTracks = callAudioStream.getAudioTracks();

        if (
            audioTracks.length > 0 &&
            audioTracks.some(function (track) {
                return track.readyState === "live";
            })
        ) {

            audioTracks.forEach(function (track) {
                track.enabled = true;
            });

            isMuted = false;

            updateMicrophoneButton();

            $callStatus.text(
                callState === "active"
                    ? "Zəng aktivdir"
                    : "Mikrofon aktivdir"
            );

            return true;

        }

        callAudioStream = null;

    }

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {

        $callStatus.text(
            "Mikrofon bu brauzerdə əlçatan deyil"
        );

        return false;

    }

    const requestId = ++microphoneRequestId;

    $toggleMuteButton.prop("disabled", true);

    $callStatus.text("Mikrofon aktivləşdirilir...");

    try {

        const stream =
            await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false
            });

        /*
         * İcazə pəncərəsi açıq olarkən istifadəçi
         * zəngi bitiribsə, əldə edilən mikrofon
         * dərhal bağlanır.
         */

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

        callAudioStream = stream;

        callAudioStream
            .getAudioTracks()
            .forEach(function (track) {
                track.enabled = true;
            });

        isMuted = false;

        updateMicrophoneButton();

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

        if (error.name === "NotAllowedError") {

            $callStatus.text(
                "Mikrofon icazəsi verilməyib"
            );

        } else if (error.name === "NotFoundError") {

            $callStatus.text(
                "Mikrofon tapılmadı"
            );

        } else if (error.name === "NotReadableError") {

            $callStatus.text(
                "Mikrofon istifadə edilə bilmir"
            );

        } else {

            $callStatus.text(
                "Mikrofonu aktivləşdirmək mümkün olmadı"
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

    /*
     * Bu, hazırkı interfeysdə taymeri başladır.
     * Real zəngdə taymer qarşı tərəfin qəbul
     * mesajı və WebRTC bağlantısı təsdiqlənəndə
     * başladılmalıdır.
     */

    startCallTimer();

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
// TOGGLE MICROPHONE
// ==========================================

async function toggleMute() {

    if (
        callState !== "active" &&
        callState !== "calling"
    ) {
        return;
    }

    /*
     * Mikrofon bağlıdırsa, istifadəçi düyməyə
     * basdıqda icazə alınır və mikrofon açılır.
     */

    if (isMuted) {

        await activateMicrophone();

        return;

    }

    /*
     * Mikrofon artıq açıqdırsa,
     * yenidən icazə istəmədən söndürülür.
     */

    isMuted = true;

    if (callAudioStream) {

        callAudioStream
            .getAudioTracks()
            .forEach(function (track) {
                track.enabled = false;
            });

    }

    updateMicrophoneButton();

    $callStatus.text("Mikrofon söndürülüb");

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

    updateSpeakerButton();

    /*
     * Hazırda yalnız düymənin vəziyyəti dəyişir.
     * Real səs çıxışını idarə etmək üçün WebRTC
     * audio bağlantısı və uyğun audio çıxış
     * idarəetməsi əlavə edilməlidir.
     */

}


// ==========================================
// CALL TIMER
// ==========================================

function startCallTimer() {

    stopCallTimer();

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
// RESET CALL
// ==========================================

function resetCall() {

    callState = "ending";

    stopCallTimer();
    stopMicrophone();

    isMuted = true;
    isSpeakerOn = true;

    callSeconds = 0;

    updateMicrophoneButton();
    updateSpeakerButton();

    $toggleMuteButton.prop("disabled", false);

    $callModal
        .prop("hidden", true)
        .attr("aria-hidden", "true");

    $callIncomingActions.prop("hidden", true);
    $callActiveActions.prop("hidden", true);

    $callDuration
        .text("00:00")
        .prop("hidden", true)
        .hide();

    $callStatus.text("Zəngə hazırdır");

    $("body").css("overflow", "");

    callState = "idle";

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
// INITIAL STATE
// ==========================================

$callModal
    .prop("hidden", true)
    .attr("aria-hidden", "true");

$callIncomingActions.prop("hidden", true);
$callActiveActions.prop("hidden", true);

$callDuration.prop("hidden", true);

updateMicrophoneButton();
updateSpeakerButton();