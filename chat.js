$(document).ready(function () {

    // =========================
    // CONVERSATION ID
    // =========================

    const conversationId =
        new URLSearchParams(window.location.search)
            .get("conversation");

    if (!conversationId) {
        window.location.href = "chats.html";
        return;
    }


    // =========================
    // CURRENT USER
    // =========================

    let currentUser = null;

    try {

        currentUser = JSON.parse(
            localStorage.getItem("currentUser")
        );

    } catch (error) {

        currentUser = null;

    }

    // =========================
    // WEBSOCKET
    // =========================

    let socket = null;

    function connectWebSocket() {

        if (
            socket &&
            (
                socket.readyState === WebSocket.OPEN ||
                socket.readyState === WebSocket.CONNECTING
            )
        ) {
            return;
        }

        const protocol =
            window.location.protocol === "https:"
                ? "wss:"
                : "ws:";

        const accessToken =
            localStorage.getItem("accessToken");

        const wsUrl =
            protocol +
            "//" +
            API_URL.replace(/^https?:\/\//, "") +
            "/ws/chat/" +
            conversationId +
            "/?token=" +
            encodeURIComponent(accessToken);

        socket = new WebSocket(wsUrl);

        socket.onopen = function () {

            console.log(
                "WebSocket bağlantısı açıldı."
            );

        };

        socket.onmessage = function (event) {

            console.log("WEBSOCKET RAW:", event.data);

            const data =
                JSON.parse(event.data);

            console.log("WEBSOCKET DATA:", data);

            if (!data.message) {
                return;
            }

            // Yalnız qarşı tərəfin mesajını göstər
            if (
                !currentUser ||
                String(data.message.sender.id) !==
                String(currentUser.id)
            ) {

                renderMessage(
                    data.message
                );

                saveCachedMessages(
                    Array.from(
                        $messagesArea.find(".message-row")
                    ).map(function () {

                        const $row = $(this);

                        return {
                            id: $row.attr("data-message-id"),
                            content: $row.find("p").text(),
                            created_at: new Date().toISOString(),
                            sender: null
                        };

                    })
                );

                scrollToBottom();

            }

        };

        socket.onclose = function () {

            console.log(
                "WebSocket bağlantısı bağlandı. Yenidən qoşulmağa çalışılır..."
            );

            setTimeout(function () {

                if (
                    !socket ||
                    socket.readyState === WebSocket.CLOSED
                ) {

                    connectWebSocket();

                }

            }, 1000);

        };

        socket.onerror = function (error) {

            console.log(
                "WebSocket xətası:",
                error
            );

        };
    }

    document.addEventListener(
        "visibilitychange",
        function () {

            if (
                document.visibilityState !== "visible"
            ) {
                return;
            }


            console.log(
                "Səhifə yenidən aktiv oldu."
            );


            // =========================
            // WEBSOCKET CHECK
            // =========================

            if (
                !socket ||
                socket.readyState !== WebSocket.OPEN
            ) {

                console.log(
                    "WebSocket yenidən qoşulur..."
                );

                connectWebSocket();

            }


            // =========================
            // CHECK NEW MESSAGES
            // =========================

            checkNewMessages();

        }
    );



    // =========================
    // ELEMENTS
    // =========================

    const $messageInput = $("#messageInput");
    const $messagesArea = $("#messagesArea");


    // =========================
    // BACK BUTTON
    // =========================

    $("#backButton").on("click", function () {

        window.location.href = "chats.html";

    });


    // =========================
    // LOAD CONVERSATION
    // =========================

    function loadConversation() {

        apiRequest({

            url:
                API_URL +
                "/api/conversations/",

            type: "GET",

            success: function (conversations) {

                const conversation =
                    conversations.find(function (item) {

                        return String(item.id) ===
                            String(conversationId);

                    });


                if (!conversation) {

                    console.log(
                        "Söhbət tapılmadı."
                    );

                    window.location.href =
                        "chats.html";

                    return;

                }


                // =========================
                // FIND OTHER USER
                // =========================

                let otherUser = null;


                if (
                    conversation.participants &&
                    conversation.participants.length
                ) {

                    otherUser =
                        conversation.participants.find(
                            function (user) {

                                if (!currentUser) {
                                    return true;
                                }

                                return String(user.id) !==
                                    String(currentUser.id);

                            }
                        );

                }


                if (!otherUser) {
                    return;
                }


                // =========================
                // USER NAME
                // =========================

                let fullName =
                    (
                        otherUser.first_name +
                        " " +
                        otherUser.last_name
                    ).trim();


                if (!fullName) {

                    fullName =
                        otherUser.username ||
                        "İstifadəçi";

                }


                $("#chatUserName").text(
                    fullName
                );


                // =========================
                // USER AVATAR
                // =========================

                let avatarText = "";


                if (otherUser.first_name) {

                    avatarText +=
                        otherUser.first_name
                            .charAt(0)
                            .toUpperCase();

                }


                if (otherUser.last_name) {

                    avatarText +=
                        otherUser.last_name
                            .charAt(0)
                            .toUpperCase();

                }


                if (!avatarText) {

                    avatarText =
                        otherUser.username
                            ? otherUser.username
                                .charAt(0)
                                .toUpperCase()
                            : "U";

                }


                $("#chatUserAvatar").text(
                    avatarText
                );


                // =========================
                // STATUS
                // =========================

                if (otherUser.last_seen) {

                    $("#chatUserStatus").text(
                        "son görülmə: " +
                        formatLastSeen(
                            otherUser.last_seen
                        )
                    );

                } else {

                    $("#chatUserStatus").text(
                        "—"
                    );

                }

            },

            error: function (xhr) {

                console.log(
                    "Söhbət yüklənmədi:",
                    xhr.responseText
                );

            }

        });

    }


    // =========================
    // LAST SEEN FORMAT
    // =========================

    function formatLastSeen(dateString) {

        const date =
            new Date(dateString);

        if (isNaN(date.getTime())) {
            return "—";
        }


        return date.toLocaleString(
            "az-AZ",
            {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit"
            }
        );

    }

    // =========================
    // MESSAGE PAGINATION
    // =========================

    let oldestMessageId = null;

    let loadingOlderMessages = false;

    let hasMoreMessages = true;

    let isInitialLoading = true;

    // =========================
    // MESSAGE CACHE
    // =========================

    function getCachedMessages() {

        try {

            return JSON.parse(
                sessionStorage.getItem(
                    "chatMessages_" + conversationId
                )
            ) || [];

        } catch (error) {

            return [];

        }
    }


    function saveCachedMessages(messages) {

        try {

            // Yalnız son 20 mesajı saxla
            const last20Messages =
                messages.slice(-20);

            sessionStorage.setItem(
                "chatMessages_" + conversationId,
                JSON.stringify(last20Messages)
            );

        } catch (error) {

            console.log(
                "Mesaj cache yadda saxlanmadı:",
                error
            );

        }
    }


    function renderCachedMessages() {

        const cachedMessages =
            getCachedMessages();

        if (!cachedMessages.length) {
            return false;
        }

        $messagesArea.empty();

        cachedMessages.forEach(function (message) {

            renderMessage(message);

        });

        oldestMessageId =
            cachedMessages[0].id;

        hasMoreMessages =
            cachedMessages.length === 20;

        scrollToBottom();

        return true;
    }



    // =========================
    // LOAD MESSAGES
    // =========================

    function loadMessages() {

        // Əvvəl cache-də olan son 20 mesajı göstər
        renderCachedMessages();


        // Sonra serverdən yenilə
        apiRequest({

            url:
                API_URL +
                "/api/conversations/" +
                conversationId +
                "/messages/",

            type: "GET",

            success: function (messages) {

                $messagesArea.empty();

                // Son 20 mesajı cache-də saxla
                saveCachedMessages(messages);

                oldestMessageId =
                    messages.length
                        ? messages[0].id
                        : null;

                hasMoreMessages =
                    messages.length === 20;


                if (!messages.length) {

                    scrollToBottom();

                    isInitialLoading = false;

                    connectWebSocket();

                    return;

                }


                messages.forEach(function (message) {

                    renderMessage(message);

                });


                requestAnimationFrame(function () {

                    scrollToBottom();

                    isInitialLoading = false;

                    connectWebSocket();

                });

            },

            error: function (xhr) {

                console.log(
                    "Mesajlar yüklənmədi:",
                    xhr.responseText
                );

                isInitialLoading = false;

            }

        });

    }


    // =========================
    // LOAD OLDER MESSAGES
    // =========================

    function loadOlderMessages() {

        if (
            loadingOlderMessages ||
            !hasMoreMessages ||
            !oldestMessageId
        ) {
            return;
        }

        loadingOlderMessages = true;

        const element = $messagesArea[0];

        const oldScrollHeight =
            element.scrollHeight;

        const oldScrollTop =
            element.scrollTop;

        apiRequest({

            url:
                API_URL +
                "/api/conversations/" +
                conversationId +
                "/messages/?before=" +
                oldestMessageId,

            type: "GET",

            success: function (messages) {

                if (!messages.length) {

                    hasMoreMessages = false;
                    loadingOlderMessages = false;

                    return;
                }

                oldestMessageId =
                    messages[0].id;

                if (messages.length < 20) {
                    hasMoreMessages = false;
                }

                for (
                    let i = messages.length - 1;
                    i >= 0;
                    i--
                ) {

                    const $message =
                        createMessageElement(
                            messages[i]
                        );

                    $messagesArea.prepend(
                        $message
                    );
                }

                const newScrollHeight =
                    element.scrollHeight;

                const scrollDifference =
                    newScrollHeight -
                    oldScrollHeight;

                // ƏVVƏLKİ MESAJ EKRANDA EYNİ YERDƏ QALIR
                element.scrollTop =
                    oldScrollTop +
                    scrollDifference;

                loadingOlderMessages = false;
            },

            error: function (xhr) {

                console.log(
                    "Köhnə mesajlar yüklənmədi:",
                    xhr.responseText
                );

                loadingOlderMessages = false;
            }
        });
    }


    // =========================
    // CREATE MESSAGE ELEMENT
    // =========================

    function createMessageElement(message) {

        const senderId =
            message.sender &&
            message.sender.id;

        const currentUserId =
            currentUser &&
            currentUser.id;

        const isSent =
            String(senderId) ===
            String(currentUserId);

        const messageClass =
            isSent
                ? "sent"
                : "received";

        const time =
            formatMessageTime(
                message.created_at
            );

        const $message = $(`
            <div class="message-row ${messageClass}"
                data-message-id="${message.id || ""}">

                <div class="message-bubble">

                    <p></p>

                    <div class="message-meta">

                        <time></time>

                        ${isSent
                ? `
                                <i class="fa-solid fa-check message-read"></i>
                            `
                : ""
            }

                    </div>

                </div>

            </div>
        `);

        $message
            .find("p")
            .text(message.content);

        $message
            .find("time")
            .text(time);

        return $message;
    }


    // =========================
    // RENDER MESSAGE
    // =========================

    function renderMessage(message) {

        const $message =
            createMessageElement(message);

        $messagesArea.append(
            $message
        );
    }




    // =========================
    // MESSAGE TIME
    // =========================

    function formatMessageTime(dateString) {

        const date =
            new Date(dateString);

        if (isNaN(date.getTime())) {

            return "";

        }


        return date.toLocaleTimeString(
            "az-AZ",
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );

    }


    // =========================
    // SEND MESSAGE
    // =========================

    function sendMessage() {

        const message =
            $messageInput
                .val()
                .trim();

        if (message === "") {
            return;
        }

        if (!socket || socket.readyState !== WebSocket.OPEN) {
            console.log("WebSocket bağlantısı açıq deyil.");
            return;
        }

        // Mesajı dərhal öz ekranımızda göstər
        renderMessage({
            id: null,
            content: message,
            sender: currentUser,
            created_at: new Date().toISOString()
        });

        scrollToBottom();

        // Serverə göndər
        socket.send(
            JSON.stringify({
                message: message
            })
        );

        $messageInput.val("");

        $messageInput.css(
            "height",
            "auto"
        );
    }


    // =========================
    // SEND BUTTON
    // =========================

    $("#sendButton").on(
        "click",
        function () {

            sendMessage();

        }
    );


    // =========================
    // ENTER TO SEND
    // SHIFT + ENTER = NEW LINE
    // =========================

    $messageInput.on(
        "keydown",
        function (event) {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                sendMessage();

            }

        }
    );


    // =========================
    // AUTO RESIZE TEXTAREA
    // =========================

    $messageInput.on(
        "input",
        function () {

            this.style.height = "auto";

            this.style.height =
                Math.min(
                    this.scrollHeight,
                    120
                ) + "px";

        }
    );


    // =========================
    // SCROLL TO BOTTOM
    // =========================

    function scrollToBottom() {

        const element = $messagesArea[0];

        if (!element) {
            return;
        }

        const footer = document.querySelector(".message-input-area");

        const footerHeight = footer
            ? footer.getBoundingClientRect().height
            : 0;

        requestAnimationFrame(function () {

            element.scrollTop =
                element.scrollHeight -
                element.clientHeight +
                footerHeight;

            setTimeout(function () {

                element.scrollTop =
                    element.scrollHeight -
                    element.clientHeight +
                    footerHeight;

            }, 100);

        });
    }


    // =========================
    // LOAD OLDER ON SCROLL
    // =========================

    $messagesArea.on(
        "scroll",
        function () {

            if (isInitialLoading) {
                return;
            }

            if (
                this.scrollTop <= 10 &&
                !loadingOlderMessages
            ) {

                loadOlderMessages();
            }

        }
    );

    // =========================
    // CHAT SEARCH
    // =========================

    $("#chatSearchButton").on(
        "click",
        function () {

            $("#chatSearchBox")
                .addClass("active");

            $("#messageSearch")
                .trigger("focus");

        }
    );


    // =========================
    // CLOSE SEARCH
    // =========================

    $("#closeChatSearch").on(
        "click",
        function () {

            $("#messageSearch").val("");

            $(".message-row").show();

            $("#chatSearchBox")
                .removeClass("active");

        }
    );


    // =========================
    // SEARCH MESSAGES
    // =========================

    $("#messageSearch").on(
        "input",
        function () {

            const searchText =
                $(this)
                    .val()
                    .toLowerCase()
                    .trim();


            if (searchText === "") {

                $(".message-row").show();

                return;

            }


            $(".message-row").each(
                function () {

                    const messageText =
                        $(this)
                            .find("p")
                            .text()
                            .toLowerCase();


                    if (
                        messageText.includes(
                            searchText
                        )
                    ) {

                        $(this).show();

                    } else {

                        $(this).hide();

                    }

                }
            );

        }
    );


    // =========================
    // MORE MENU
    // =========================

    $("#chatMoreButton").on(
        "click",
        function (event) {

            event.stopPropagation();

            $("#chatMoreMenu")
                .toggleClass("active");

            $("#attachmentMenu")
                .removeClass("active");

            $("#emojiMenu")
                .removeClass("active");

        }
    );


    // =========================
    // ATTACHMENT MENU
    // =========================

    $("#attachmentButton").on(
        "click",
        function (event) {

            event.stopPropagation();

            $("#attachmentMenu")
                .toggleClass("active");

            $("#chatMoreMenu")
                .removeClass("active");

            $("#emojiMenu")
                .removeClass("active");

        }
    );


    // =========================
    // CLOSE MENUS
    // =========================

    $(document).on(
        "click",
        function () {

            $("#chatMoreMenu")
                .removeClass("active");

            $("#attachmentMenu")
                .removeClass("active");

        }
    );


    // =========================
    // MENU CLICK
    // =========================

    $("#chatMoreMenu, #attachmentMenu")
        .on(
            "click",
            function (event) {

                event.stopPropagation();

            }
        );


    // =========================
    // PHOTO
    // =========================

    $("#photoButton").on(
        "click",
        function () {

            $("#fileInput").attr(
                "accept",
                "image/*"
            );

            $("#fileInput")
                .trigger("click");

        }
    );


    // =========================
    // FILE
    // =========================

    $("#fileButton").on(
        "click",
        function () {

            $("#fileInput").attr(
                "accept",
                "*/*"
            );

            $("#fileInput")
                .trigger("click");

        }
    );


    // =========================
    // FILE SELECTED
    // =========================

    $("#fileInput").on(
        "change",
        function () {

            const file =
                this.files[0];


            if (!file) {
                return;
            }


            console.log(
                "Seçilmiş fayl:",
                file.name
            );


            // Backend upload sistemi
            // sonra əlavə ediləcək.

            $(this).val("");

        }
    );


    // =========================
    // MUTE CHAT
    // =========================

    $("#muteChatButton").on(
        "click",
        function () {

            $("#chatMoreMenu")
                .removeClass("active");

            console.log(
                "Bildirişlər susduruldu."
            );

        }
    );


    // =========================
    // CLEAR CHAT
    // =========================

    $("#clearChatButton").on(
        "click",
        function () {

            $("#chatMoreMenu")
                .removeClass("active");

            console.log(
                "Söhbəti təmizlə düyməsi."
            );

        }
    );


    // =========================
    // BLOCK USER
    // =========================

    $("#blockUserButton").on(
        "click",
        function () {

            $("#chatMoreMenu")
                .removeClass("active");

            console.log(
                "Əməkdaş bloklama düyməsi."
            );

        }
    );


    // =========================
    // ESC KEY
    // =========================

    $(document).on(
        "keydown",
        function (event) {

            if (event.key !== "Escape") {
                return;
            }


            $("#chatSearchBox")
                .removeClass("active");

            $("#chatMoreMenu")
                .removeClass("active");

            $("#attachmentMenu")
                .removeClass("active");

            $("#emojiMenu")
                .removeClass("active");

            $("#messageSearch").val("");

            $(".message-row").show();

        }
    );


    // =========================
    // EMOJI MENU
    // =========================

    $("#emojiButton").on(
        "click",
        function (event) {

            event.stopPropagation();

            $("#emojiMenu")
                .toggleClass("active");

            $("#chatMoreMenu")
                .removeClass("active");

            $("#attachmentMenu")
                .removeClass("active");

        }
    );


    // =========================
    // SELECT EMOJI
    // =========================

    $(".emoji-item").on(
        "click",
        function (event) {

            event.stopPropagation();


            const emoji =
                $(this).text();


            const textarea =
                $("#messageInput")[0];


            const start =
                textarea.selectionStart;


            const end =
                textarea.selectionEnd;


            const text =
                textarea.value;


            textarea.value =
                text.substring(0, start) +
                emoji +
                text.substring(end);


            textarea.selectionStart =
                start + emoji.length;


            textarea.selectionEnd =
                start + emoji.length;


            $("#messageInput")
                .trigger("input");


            textarea.focus();

        }
    );


    // =========================
    // CLOSE EMOJI MENU
    // =========================

    $(document).on(
        "click",
        function () {

            $("#emojiMenu")
                .removeClass("active");

        }
    );


    $("#emojiMenu").on(
        "click",
        function (event) {

            event.stopPropagation();

        }
    );


    // =========================
    // INITIAL LOAD
    // =========================

    loadConversation();

    loadMessages();

    // =========================
    // CHECK NEW MESSAGES
    // =========================

    function checkNewMessages() {

        apiRequest({

            url:
                API_URL +
                "/api/conversations/" +
                conversationId +
                "/messages/",

            type: "GET",

            success: function (messages) {

                if (!messages.length) {
                    return;
                }

                let addedNewMessage = false;

                messages.forEach(function (message) {

                    const exists =
                        $messagesArea.find(
                            `[data-message-id="${message.id}"]`
                        ).length;

                    if (!exists) {

                        renderMessage(message);

                        addedNewMessage = true;

                    }

                });

                if (addedNewMessage) {

                    scrollToBottom();

                }

            },

            error: function (xhr) {

                console.log(
                    "Yeni mesajlar yoxlanılmadı:",
                    xhr.responseText
                );

            }

        });

    }


});