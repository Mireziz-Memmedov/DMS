$(document).ready(function () {

    // =========================
    // BACK BUTTON
    // =========================

    $("#backButton").on("click", function () {
        window.location.href = "chats.html";
    });


    // =========================
    // MESSAGE INPUT
    // =========================

    const $messageInput = $("#messageInput");
    const $messagesArea = $("#messagesArea");


    // =========================
    // SEND MESSAGE
    // =========================

    function sendMessage() {

        const message = $messageInput.val().trim();

        if (message === "") {
            return;
        }

        const currentTime = new Date().toLocaleTimeString("az-AZ", {
            hour: "2-digit",
            minute: "2-digit"
        });


        const messageHTML = `
            <div class="message-row sent">

                <div class="message-bubble">

                    <p></p>

                    <div class="message-meta">

                        <time>${currentTime}</time>

                        <i class="fa-solid fa-check message-read"></i>

                    </div>

                </div>

            </div>
        `;


        const $message = $(messageHTML);

        $message.find("p").text(message);

        $messagesArea.append($message);


        // Input təmizlə
        $messageInput.val("");


        // Textarea ölçüsünü sıfırla
        $messageInput.css("height", "auto");


        // Aşağı scroll
        scrollToBottom();
    }


    // =========================
    // SEND BUTTON
    // =========================

    $("#sendButton").on("click", function () {
        sendMessage();
    });


    // =========================
    // ENTER TO SEND
    // SHIFT + ENTER = NEW LINE
    // =========================

    $messageInput.on("keydown", function (event) {

        if (event.key === "Enter" && !event.shiftKey) {

            event.preventDefault();

            sendMessage();
        }

    });


    // =========================
    // AUTO RESIZE TEXTAREA
    // =========================

    $messageInput.on("input", function () {

        this.style.height = "auto";

        this.style.height = Math.min(
            this.scrollHeight,
            120
        ) + "px";

    });


    // =========================
    // SCROLL TO BOTTOM
    // =========================

    function scrollToBottom() {

        const element = $messagesArea[0];

        if (!element) {
            return;
        }

        element.scrollTop = element.scrollHeight;
    }


    // Səhifə açıldıqda aşağıda göstər
    scrollToBottom();


    // =========================
    // CHAT SEARCH
    // =========================

    $("#chatSearchButton").on("click", function () {

        $("#chatSearchBox").addClass("active");

        $("#messageSearch").trigger("focus");

    });


    // =========================
    // CLOSE SEARCH
    // =========================

    $("#closeChatSearch").on("click", function () {

        $("#messageSearch").val("");

        $(".message-row").show();

        $("#chatSearchBox").removeClass("active");

    });


    // =========================
    // SEARCH MESSAGES
    // =========================

    $("#messageSearch").on("input", function () {

        const searchText = $(this).val()
            .toLowerCase()
            .trim();


        if (searchText === "") {

            $(".message-row").show();

            return;
        }


        $(".message-row").each(function () {

            const messageText = $(this)
                .find("p")
                .text()
                .toLowerCase();


            if (messageText.includes(searchText)) {

                $(this).show();

            } else {

                $(this).hide();

            }

        });

    });


    // =========================
    // MORE MENU
    // =========================

    $("#chatMoreButton").on("click", function (event) {

        event.stopPropagation();

        $("#chatMoreMenu").toggleClass("active");

        $("#attachmentMenu").removeClass("active");

    });


    // =========================
    // ATTACHMENT MENU
    // =========================

    $("#attachmentButton").on("click", function (event) {

        event.stopPropagation();

        $("#attachmentMenu").toggleClass("active");

        $("#chatMoreMenu").removeClass("active");

    });


    // =========================
    // CLOSE MENUS
    // =========================

    $(document).on("click", function () {

        $("#chatMoreMenu").removeClass("active");

        $("#attachmentMenu").removeClass("active");

    });


    // Menyunun özünə klik edəndə bağlanmasın
    $("#chatMoreMenu, #attachmentMenu").on("click", function (event) {

        event.stopPropagation();

    });


    // =========================
    // PHOTO
    // =========================

    $("#photoButton").on("click", function () {

        $("#fileInput").attr(
            "accept",
            "image/*"
        );

        $("#fileInput").trigger("click");

    });


    // =========================
    // FILE
    // =========================

    $("#fileButton").on("click", function () {

        $("#fileInput").attr(
            "accept",
            "*/*"
        );

        $("#fileInput").trigger("click");

    });


    // =========================
    // FILE SELECTED
    // =========================

    $("#fileInput").on("change", function () {

        const file = this.files[0];

        if (!file) {
            return;
        }

        console.log("Seçilmiş fayl:", file.name);

        // Backend qoşulanda burada upload edəcəyik.

        $(this).val("");

    });


    // =========================
    // MUTE CHAT
    // =========================

    $("#muteChatButton").on("click", function () {

        $("#chatMoreMenu").removeClass("active");

        console.log("Bildirişlər susduruldu.");

    });


    // =========================
    // CLEAR CHAT
    // =========================

    $("#clearChatButton").on("click", function () {

        $("#chatMoreMenu").removeClass("active");

        console.log("Söhbəti təmizlə düyməsi.");

    });


    // =========================
    // BLOCK USER
    // =========================

    $("#blockUserButton").on("click", function () {

        $("#chatMoreMenu").removeClass("active");

        console.log("Əməkdaş bloklama düyməsi.");

    });


    // =========================
    // ESC KEY
    // =========================

    $(document).on("keydown", function (event) {

        if (event.key !== "Escape") {
            return;
        }

        $("#chatSearchBox").removeClass("active");

        $("#chatMoreMenu").removeClass("active");

        $("#attachmentMenu").removeClass("active");

        $("#messageSearch").val("");

        $(".message-row").show();

    });

});