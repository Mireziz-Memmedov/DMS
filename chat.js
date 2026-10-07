$(document).ready(function () {

    // =========================================================
    // CONVERSATION ID
    // =========================================================

    const conversationId =
        new URLSearchParams(window.location.search)
            .get("conversation");

    if (!conversationId) {
        window.location.href = "chats.html";
        return;
    }


    // =========================================================
    // CURRENT USER
    // =========================================================

    let currentUser = null;

    try {
        currentUser = JSON.parse(
            localStorage.getItem("currentUser")
        );
    } catch (error) {
        currentUser = null;
    }


    // =========================================================
    // ELEMENTS
    // =========================================================

    const $messageInput =
        $("#messageInput");

    const $messagesArea =
        $("#messagesArea");


    // =========================================================
    // MESSAGE STATE
    // =========================================================

    const renderedMessageIds =
        new Set();

    const liveMessages =
        new Map();

    let pendingMessages = [];

    let socket = null;

    let reconnectTimer = null;

    let presenceTimer = null;

    let isInitialLoading = true;

    let cacheLoaded = false;

    let apiLoaded = false;

    let loadingOlderMessages = false;

    let oldestMessageId = null;

    let hasMoreMessages = true;


    // =========================================================
    // INDEXEDDB
    // =========================================================

    let db = null;

    const DB_NAME =
        "DMS_DB";

    const DB_VERSION =
        4;

    const MESSAGE_STORE =
        "messages";

    const CONVERSATION_STORE =
        "conversations";


    const dbRequest =
        indexedDB.open(
            DB_NAME,
            DB_VERSION
        );


    // =========================================================
    // INDEXEDDB UPGRADE
    // =========================================================

    dbRequest.onupgradeneeded =
        function (event) {

            db =
                event.target.result;


            // =====================================================
            // MESSAGE STORE
            // =====================================================

            if (
                !db.objectStoreNames.contains(
                    MESSAGE_STORE
                )
            ) {

                const store =
                    db.createObjectStore(
                        MESSAGE_STORE,
                        {
                            keyPath: "id"
                        }
                    );


                store.createIndex(
                    "conversationId",
                    "conversationId",
                    {
                        unique: false
                    }
                );


                store.createIndex(
                    "created_at",
                    "created_at",
                    {
                        unique: false
                    }
                );

            }


            // =====================================================
            // CONVERSATION STORE
            // =====================================================

            if (
                !db.objectStoreNames.contains(
                    CONVERSATION_STORE
                )
            ) {

                db.createObjectStore(
                    CONVERSATION_STORE,
                    {
                        keyPath: "conversationId"
                    }
                );

            }

        };


    // =========================================================
    // INDEXEDDB READY
    // =========================================================

    dbRequest.onsuccess =
        function (event) {

            db =
                event.target.result;

            console.log(
                "IndexedDB hazırdır."
            );


            // Əvvəl istifadəçi məlumatını cache-dən göstər
            loadConversationFromDB();


            // Əvvəl mesajları cache-dən göstər
            loadMessagesFromDB(
                function () {

                    cacheLoaded = true;

                    /*
                     * Cache ekrana gəldikdən sonra API yüklənir.
                     *
                     * Əsas düzəliş budur:
                     * API artıq IndexedDB ilə yarışmır.
                     */
                    loadMessages();

                }
            );

        };


    dbRequest.onerror =
        function (event) {

            console.log(
                "IndexedDB xətası:",
                event.target.error
            );

            /*
             * IndexedDB işləməsə belə
             * chat yenə API-dən işləməlidir.
             */
            cacheLoaded = true;

            loadMessages();

        };


    // =========================================================
    // SAVE MESSAGE TO INDEXEDDB
    // =========================================================

    function saveMessageToDB(message) {

        if (
            !db ||
            !message ||
            !message.id ||
            message.optimistic
        ) {
            return;
        }


        const transaction =
            db.transaction(
                MESSAGE_STORE,
                "readwrite"
            );


        const store =
            transaction.objectStore(
                MESSAGE_STORE
            );


        store.put({

            id:
                message.id,

            conversationId:
                String(conversationId),

            sender:
                message.sender,

            content:
                message.content,

            created_at:
                message.created_at

        });


        transaction.onerror =
            function (event) {

                console.log(
                    "Mesaj IndexedDB-yə yazılmadı:",
                    event.target.error
                );

            };

    }


    // =========================================================
    // SAVE CONVERSATION TO INDEXEDDB
    // =========================================================

    function saveConversationToDB(otherUser) {

        if (
            !db ||
            !otherUser ||
            !conversationId
        ) {
            return;
        }


        const transaction =
            db.transaction(
                CONVERSATION_STORE,
                "readwrite"
            );


        const store =
            transaction.objectStore(
                CONVERSATION_STORE
            );


        store.put({

            conversationId:
                String(conversationId),

            user:
                otherUser

        });


        transaction.onerror =
            function (event) {

                console.log(
                    "İstifadəçi IndexedDB-yə yazılmadı:",
                    event.target.error
                );

            };

    }


    // =========================================================
    // LOAD CONVERSATION FROM INDEXEDDB
    // =========================================================

    function loadConversationFromDB() {

        if (
            !db ||
            !conversationId
        ) {
            return;
        }


        const transaction =
            db.transaction(
                CONVERSATION_STORE,
                "readonly"
            );


        const store =
            transaction.objectStore(
                CONVERSATION_STORE
            );


        const request =
            store.get(
                String(conversationId)
            );


        request.onsuccess =
            function () {

                const cachedConversation =
                    request.result;


                if (
                    !cachedConversation ||
                    !cachedConversation.user
                ) {
                    return;
                }


                renderChatUser(
                    cachedConversation.user
                );

            };


        request.onerror =
            function (event) {

                console.log(
                    "İstifadəçi IndexedDB-dən oxunmadı:",
                    event.target.error
                );

            };

    }


    // =========================================================
    // LOAD MESSAGES FROM INDEXEDDB
    // =========================================================

    function loadMessagesFromDB(onComplete) {

        if (!db) {

            if (typeof onComplete === "function") {
                onComplete();
            }

            return;
        }


        const transaction =
            db.transaction(
                MESSAGE_STORE,
                "readonly"
            );


        const store =
            transaction.objectStore(
                MESSAGE_STORE
            );


        const index =
            store.index(
                "conversationId"
            );


        const request =
            index.getAll(
                String(conversationId)
            );


        request.onsuccess =
            function () {

                const messages =
                    request.result || [];

                console.log("IDB MESSAGES:", messages);


                messages.sort(
                    function (a, b) {

                        return new Date(
                            a.created_at
                        ) -
                            new Date(
                                b.created_at
                            );

                    }
                );


                const lastMessages =
                    messages.slice(-20);


                /*
                 * Cache varsa birbaşa göstər.
                 */
                if (lastMessages.length) {

                    $messagesArea.empty();

                    renderedMessageIds.clear();


                    lastMessages.forEach(
                        function (message) {

                            if (
                                !message ||
                                !message.id
                            ) {
                                return;
                            }


                            const messageId =
                                String(
                                    message.id
                                );


                            if (
                                renderedMessageIds.has(
                                    messageId
                                )
                            ) {
                                return;
                            }


                            renderedMessageIds.add(
                                messageId
                            );


                            liveMessages.set(
                                messageId,
                                message
                            );


                            const $message =
                                createMessageElement(
                                    message
                                );


                            $messagesArea.append(
                                $message
                            );

                        }
                    );


                    requestAnimationFrame(
                        function () {

                            scrollToBottom();

                        }
                    );

                }


                /*
                 * Cache-dən oxunan mesajlar artıq
                 * initial state hesab olunur.
                 */
                isInitialLoading = false;


                if (typeof onComplete === "function") {
                    onComplete();
                }

            };


        request.onerror =
            function (event) {

                console.log(
                    "IndexedDB mesajları oxunmadı:",
                    event.target.error
                );

                isInitialLoading = false;


                if (typeof onComplete === "function") {
                    onComplete();
                }

            };

    }


    // =========================================================
    // WEBSOCKET
    // =========================================================

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


        if (reconnectTimer) {

            clearTimeout(
                reconnectTimer
            );

            reconnectTimer = null;

        }


        const accessToken =
            localStorage.getItem(
                "accessToken"
            );


        if (!accessToken) {

            console.log(
                "Access token yoxdur."
            );

            return;
        }


        const protocol =
            window.location.protocol === "https:"
                ? "wss:"
                : "ws:";


        const wsUrl =
            protocol +
            "//" +
            API_URL.replace(
                /^https?:\/\//,
                ""
            ) +
            "/ws/chat/" +
            conversationId +
            "/?token=" +
            encodeURIComponent(
                accessToken
            );


        console.log(
            "WebSocket qoşulur..."
        );


        const newSocket =
            new WebSocket(
                wsUrl
            );


        socket =
            newSocket;


        // =====================================================
        // OPEN
        // =====================================================

        newSocket.onopen =
            function () {

                if (
                    socket !== newSocket
                ) {
                    return;
                }


                console.log(
                    "WebSocket bağlantısı açıldı."
                );


                sendPresence();


                if (presenceTimer) {

                    clearInterval(
                        presenceTimer
                    );

                }


                presenceTimer =
                    setInterval(
                        function () {

                            if (
                                socket &&
                                socket.readyState ===
                                WebSocket.OPEN
                            ) {

                                sendPresence();

                            }

                        },
                        30000
                    );


                flushPendingMessages();

            };


        // =====================================================
        // MESSAGE
        // =====================================================

        newSocket.onmessage =
            function (event) {


                if (
                    socket !== newSocket
                ) {
                    return;
                }


                let data = null;


                try {

                    data =
                        JSON.parse(
                            event.data
                        );

                } catch (error) {

                    console.log(
                        "WebSocket JSON xətası:",
                        error
                    );

                    return;

                }


                if (
                    !data ||
                    !data.message
                ) {
                    return;
                }


                const message =
                    data.message;

                console.log("WS MESSAGE:", message);

                if (
                    !message ||
                    !message.id
                ) {
                    return;
                }


                const optimisticElement =
                    findOptimisticMessage(
                        message
                    );


                if (optimisticElement) {

                    optimisticElement.remove();

                }


                renderMessage(
                    message
                );


                scrollToBottom();

            };


        // =====================================================
        // CLOSE
        // =====================================================

        newSocket.onclose =
            function () {

                if (
                    socket !== newSocket
                ) {
                    return;
                }


                socket = null;


                if (presenceTimer) {

                    clearInterval(
                        presenceTimer
                    );

                    presenceTimer = null;

                }


                console.log(
                    "WebSocket bağlantısı bağlandı."
                );


                scheduleReconnect();

            };


        // =====================================================
        // ERROR
        // =====================================================

        newSocket.onerror =
            function (error) {

                if (
                    socket !== newSocket
                ) {
                    return;
                }


                console.log(
                    "WebSocket xətası:",
                    error
                );

            };

    }


    // =========================================================
    // RECONNECT
    // =========================================================

    function scheduleReconnect() {

        if (reconnectTimer) {
            return;
        }


        reconnectTimer =
            setTimeout(
                function () {

                    reconnectTimer = null;

                    connectWebSocket();

                },
                1000
            );

    }


    // =========================================================
    // PRESENCE
    // =========================================================

    function sendPresence() {

        if (
            !socket ||
            socket.readyState !==
            WebSocket.OPEN
        ) {
            return;
        }


        try {

            socket.send(
                JSON.stringify({
                    type: "presence"
                })
            );

        } catch (error) {

            console.log(
                "Presence göndərilmədi:",
                error
            );

        }

    }


    // =========================================================
    // FLUSH PENDING
    // =========================================================

    function flushPendingMessages() {

        if (
            !socket ||
            socket.readyState !==
            WebSocket.OPEN
        ) {
            return;
        }


        if (!pendingMessages.length) {
            return;
        }


        const messagesToSend =
            pendingMessages.slice();


        pendingMessages = [];


        messagesToSend.forEach(
            function (item) {

                try {

                    socket.send(
                        JSON.stringify({

                            message:
                                item.message,

                            client_id:
                                item.client_id

                        })
                    );

                } catch (error) {

                    console.log(
                        "Pending mesaj göndərilmədi:",
                        error
                    );


                    pendingMessages.push(
                        item
                    );

                }

            }
        );

    }


    // =========================================================
    // VISIBILITY CHANGE
    // =========================================================

    document.addEventListener(
        "visibilitychange",
        function () {

            if (
                document.visibilityState !==
                "visible"
            ) {
                return;
            }


            console.log(
                "Səhifə yenidən aktiv oldu."
            );


            if (
                !socket ||
                socket.readyState !==
                WebSocket.OPEN
            ) {

                connectWebSocket();

            } else {

                sendPresence();

            }


            loadConversation();

            checkNewMessages();

        }
    );


    // =========================================================
    // BACK BUTTON
    // =========================================================

    $("#backButton").on(
        "click",
        function () {

            window.location.href =
                "chats.html";

        }
    );


    // =========================================================
    // RENDER CHAT USER
    // =========================================================

    function renderChatUser(otherUser) {

        if (!otherUser) {
            return;
        }


        // =====================================================
        // NAME
        // =====================================================

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


        $("#chatUserName")
            .text(fullName);


        // =====================================================
        // AVATAR
        // =====================================================

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


        $("#chatUserAvatar")
            .text(avatarText);


        // =====================================================
        // STATUS
        // =====================================================

        const $status =
            $("#chatUserStatus");


        if (
            otherUser.is_online === true
        ) {

            $status
                .text("Onlayn")
                .removeClass("offline")
                .addClass("online");

            return;

        }


        if (otherUser.last_seen) {

            $status
                .text(
                    "Son giriş: " +
                    formatLastSeen(
                        otherUser.last_seen
                    )
                )
                .removeClass("online")
                .addClass("offline");

            return;

        }


        $status
            .text(
                "Son giriş məlum deyil"
            )
            .removeClass("online")
            .addClass("offline");

    }


    // =========================================================
    // LOAD CONVERSATION
    // =========================================================

    function loadConversation() {

        apiRequest({

            url:
                API_URL +
                "/api/conversations/",

            type:
                "GET",


            success:
                function (conversations) {

                    const conversation =
                        conversations.find(
                            function (item) {

                                return (
                                    String(item.id) ===
                                    String(conversationId)
                                );

                            }
                        );


                    if (!conversation) {

                        console.log(
                            "Söhbət tapılmadı."
                        );


                        window.location.href =
                            "chats.html";

                        return;

                    }


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


                                    return (
                                        String(user.id) !==
                                        String(currentUser.id)
                                    );

                                }
                            );

                    }


                    if (!otherUser) {
                        return;
                    }


                    renderChatUser(
                        otherUser
                    );


                    saveConversationToDB(
                        otherUser
                    );

                },


            error:
                function (xhr) {

                    console.log(
                        "Söhbət yüklənmədi:",
                        xhr.responseText
                    );

                }

        });

    }


    // =========================================================
    // LAST SEEN FORMAT
    // =========================================================

    function formatLastSeen(
        dateString
    ) {

        const date =
            new Date(
                dateString
            );


        if (
            isNaN(
                date.getTime()
            )
        ) {

            return "—";

        }


        return date.toLocaleString(
            "az-AZ",
            {

                day:
                    "2-digit",

                month:
                    "2-digit",

                hour:
                    "2-digit",

                minute:
                    "2-digit"

            }
        );

    }


    // =========================================================
    // LOAD MESSAGES FROM API
    // =========================================================

    function loadMessages() {


        apiRequest({

            url:
                API_URL +
                "/api/conversations/" +
                conversationId +
                "/messages/",

            type:
                "GET",


            success:
                function (messages) {

                    console.log("API TYPE:", typeof messages);
                    console.log("IS ARRAY:", Array.isArray(messages));
                    console.log("API RAW:", messages);

                    const serverMessages =
                        Array.isArray(messages)
                            ? messages.slice(-20)
                            : [];


                    /*
                     * ƏSAS DÜZƏLİŞ:
                     *
                     * DOM-u empty() etmirik.
                     *
                     * Cache-dən görünən mesajlar qalır.
                     * API-də olmayanları əlavə edirik.
                     * API-də olanları IndexedDB-yə yazırıq.
                     */


                    serverMessages.forEach(
                        function (message) {

                            if (
                                !message ||
                                !message.id
                            ) {
                                return;
                            }


                            const messageId =
                                String(
                                    message.id
                                );


                            liveMessages.set(
                                messageId,
                                message
                            );


                            saveMessageToDB(
                                message
                            );


                            /*
                             * Əgər artıq cache/WebSocket
                             * tərəfindən göstərilibsə,
                             * ikinci dəfə göstərmə.
                             */
                            if (
                                renderedMessageIds.has(
                                    messageId
                                )
                            ) {
                                return;
                            }


                            renderMessage(
                                message
                            );

                        }
                    );


                    /*
                     * Əgər API-dən gələn son 20 mesaj
                     * cache-dən daha yenidirsə,
                     * DOM artıq onları əlavə edib.
                     *
                     * Burada optimistic mesajların da
                     * silinməsinə tələsmirik.
                     */


                    oldestMessageId =
                        serverMessages.length
                            ? serverMessages[0].id
                            : oldestMessageId;


                    hasMoreMessages =
                        serverMessages.length === 20;


                    apiLoaded = true;

                    isInitialLoading = false;


                    /*
                     * API-dən sonra həmişə aşağıya keçirik.
                     * Amma yalnız initial chat açılışında.
                     */
                    if (cacheLoaded) {

                        requestAnimationFrame(
                            function () {

                                scrollToBottom();

                            }
                        );

                    }

                },


            error:
                function (xhr) {

                    console.log(
                        "Mesajlar yüklənmədi:",
                        xhr.responseText
                    );


                    apiLoaded = true;

                    isInitialLoading = false;

                }

        });


    }


    // =========================================================
    // LOAD OLDER MESSAGES
    // =========================================================

    function loadOlderMessages() {

        if (
            loadingOlderMessages ||
            !hasMoreMessages ||
            !oldestMessageId
        ) {
            return;
        }


        loadingOlderMessages = true;


        const element =
            $messagesArea[0];


        if (!element) {

            loadingOlderMessages = false;

            return;

        }


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
                encodeURIComponent(
                    oldestMessageId
                ),

            type:
                "GET",


            success:
                function (messages) {

                    if (
                        !Array.isArray(messages) ||
                        !messages.length
                    ) {

                        hasMoreMessages = false;

                        loadingOlderMessages = false;

                        return;

                    }


                    oldestMessageId =
                        messages[0].id;


                    if (
                        messages.length < 20
                    ) {

                        hasMoreMessages = false;

                    }


                    for (
                        let i =
                            messages.length - 1;

                        i >= 0;

                        i--
                    ) {

                        const message =
                            messages[i];


                        if (
                            !message ||
                            !message.id
                        ) {
                            continue;
                        }


                        const messageId =
                            String(
                                message.id
                            );


                        if (
                            renderedMessageIds.has(
                                messageId
                            )
                        ) {
                            continue;
                        }


                        renderedMessageIds.add(
                            messageId
                        );


                        liveMessages.set(
                            messageId,
                            message
                        );


                        saveMessageToDB(
                            message
                        );


                        const $message =
                            createMessageElement(
                                message
                            );


                        $messagesArea.prepend(
                            $message
                        );

                    }


                    requestAnimationFrame(
                        function () {

                            const newScrollHeight =
                                element.scrollHeight;


                            const scrollDifference =
                                newScrollHeight -
                                oldScrollHeight;


                            element.scrollTop =
                                oldScrollTop +
                                scrollDifference;


                            loadingOlderMessages =
                                false;

                        }
                    );

                },


            error:
                function (xhr) {

                    console.log(
                        "Köhnə mesajlar yüklənmədi:",
                        xhr.responseText
                    );


                    loadingOlderMessages = false;

                }

        });

    }


    // =========================================================
    // CREATE MESSAGE ELEMENT
    // =========================================================

    function createMessageElement(
        message
    ) {

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


        const clientId =
            message.client_id || "";


        const optimisticClass =
            message.optimistic
                ? " optimistic-message"
                : "";


        const messageId =
            message.id || "";


        const $message = $(`
            <div
                class="message-row ${messageClass}${optimisticClass}"
                data-message-id="${escapeHtmlAttribute(messageId)}"
                data-client-id="${escapeHtmlAttribute(clientId)}"
            >

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
            .text(
                message.content || ""
            );


        $message
            .find("time")
            .text(
                time
            );


        return $message;

    }


    // =========================================================
    // ESCAPE HTML ATTRIBUTE
    // =========================================================

    function escapeHtmlAttribute(
        value
    ) {

        return String(value)
            .replace(
                /&/g,
                "&amp;"
            )
            .replace(
                /"/g,
                "&quot;"
            )
            .replace(
                /</g,
                "&lt;"
            )
            .replace(
                />/g,
                "&gt;"
            );

    }


    // =========================================================
    // RENDER MESSAGE
    // =========================================================

    function renderMessage(
        message
    ) {

        if (
            !message ||
            !message.id
        ) {
            return;
        }


        const messageId =
            String(
                message.id
            );


        if (
            renderedMessageIds.has(
                messageId
            )
        ) {
            return;
        }


        renderedMessageIds.add(
            messageId
        );


        if (
            !message.optimistic
        ) {

            liveMessages.set(
                messageId,
                message
            );

        }


        const $message =
            createMessageElement(
                message
            );


        $messagesArea.append(
            $message
        );


        if (
            !message.optimistic
        ) {

            saveMessageToDB(
                message
            );

        }

    }


    // =========================================================
    // FIND OPTIMISTIC MESSAGE
    // =========================================================

    function findOptimisticMessage(
        serverMessage
    ) {

        if (!serverMessage) {
            return null;
        }


        const serverClientId =
            serverMessage.client_id;


        // =====================================================
        // CLIENT ID
        // =====================================================

        if (serverClientId) {

            const $exactMessage =
                $messagesArea.find(
                    '.optimistic-message[data-client-id="' +
                    escapeSelectorValue(
                        serverClientId
                    ) +
                    '"]'
                );


            if (
                $exactMessage.length
            ) {

                return $exactMessage.first();

            }

        }


        // =====================================================
        // FALLBACK
        // =====================================================

        const serverSenderId =
            serverMessage.sender &&
            serverMessage.sender.id;


        const currentUserId =
            currentUser &&
            currentUser.id;


        if (
            String(serverSenderId) !==
            String(currentUserId)
        ) {

            return null;

        }


        const $optimisticMessages =
            $messagesArea
                .find(
                    ".optimistic-message"
                )
                .toArray()
                .reverse();


        const serverContent =
            String(
                serverMessage.content || ""
            ).trim();


        for (
            let i = 0;

            i < $optimisticMessages.length;

            i++
        ) {

            const $item =
                $(
                    $optimisticMessages[i]
                );


            const content =
                String(
                    $item
                        .find("p")
                        .text()
                ).trim();


            if (
                content ===
                serverContent
            ) {

                return $item;

            }

        }


        return null;

    }


    // =========================================================
    // ESCAPE SELECTOR VALUE
    // =========================================================

    function escapeSelectorValue(
        value
    ) {

        return String(value)
            .replace(
                /\\/g,
                "\\\\"
            )
            .replace(
                /"/g,
                '\\"'
            );

    }


    // =========================================================
    // MESSAGE TIME
    // =========================================================

    function formatMessageTime(
        dateString
    ) {

        const date =
            new Date(
                dateString
            );


        if (
            isNaN(
                date.getTime()
            )
        ) {

            return "";

        }


        return date.toLocaleTimeString(
            "az-AZ",
            {

                hour:
                    "2-digit",

                minute:
                    "2-digit"

            }
        );

    }


    // =========================================================
    // SEND MESSAGE
    // =========================================================

    function sendMessage() {

        const message =
            $messageInput
                .val()
                .trim();


        if (
            message === ""
        ) {
            return;
        }


        const clientId =
            "client_" +
            Date.now() +
            "_" +
            Math.random()
                .toString(36)
                .substring(2, 9);


        $messageInput.val("");


        $messageInput.css(
            "height",
            "auto"
        );


        const optimisticMessage = {

            id:
                clientId,

            client_id:
                clientId,

            sender:
                currentUser,

            content:
                message,

            created_at:
                new Date().toISOString(),

            optimistic:
                true

        };


        renderMessage(
            optimisticMessage
        );


        scrollToBottom();


        if (
            socket &&
            socket.readyState ===
            WebSocket.OPEN
        ) {

            try {

                socket.send(
                    JSON.stringify({

                        message:
                            message,

                        client_id:
                            clientId

                    })
                );

            } catch (error) {

                console.log(
                    "Mesaj göndərilmədi:",
                    error
                );


                pendingMessages.push({

                    message:
                        message,

                    client_id:
                        clientId

                });


                connectWebSocket();

            }


            return;

        }


        console.log(
            "WebSocket hazır deyil. Mesaj növbəyə əlavə edildi."
        );


        pendingMessages.push({

            message:
                message,

            client_id:
                clientId

        });


        connectWebSocket();

    }


    // =========================================================
    // SEND BUTTON
    // =========================================================

    $("#sendButton").on(
        "click",
        function () {

            sendMessage();

        }
    );


    // =========================================================
    // ENTER TO SEND
    // =========================================================

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


    // =========================================================
    // AUTO RESIZE
    // =========================================================

    $messageInput.on(
        "input",
        function () {

            this.style.height =
                "auto";


            this.style.height =
                Math.min(
                    this.scrollHeight,
                    120
                ) +
                "px";

        }
    );


    // =========================================================
    // SCROLL TO BOTTOM
    // =========================================================

    function scrollToBottom() {

        const element =
            $messagesArea[0];


        if (!element) {
            return;
        }


        requestAnimationFrame(
            function () {

                element.scrollTop =
                    element.scrollHeight;

            }
        );

    }


    // =========================================================
    // LOAD OLDER ON SCROLL
    // =========================================================

    $messagesArea.on(
        "scroll",
        function () {

            if (
                isInitialLoading
            ) {
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


    // =========================================================
    // CHAT SEARCH
    // =========================================================

    $("#chatSearchButton").on(
        "click",
        function () {

            $("#chatSearchBox")
                .addClass(
                    "active"
                );


            $("#messageSearch")
                .trigger(
                    "focus"
                );

        }
    );


    // =========================================================
    // CLOSE SEARCH
    // =========================================================

    $("#closeChatSearch").on(
        "click",
        function () {

            $("#messageSearch")
                .val("");


            $(".message-row")
                .show();


            $("#chatSearchBox")
                .removeClass(
                    "active"
                );

        }
    );


    // =========================================================
    // SEARCH MESSAGES
    // =========================================================

    $("#messageSearch").on(
        "input",
        function () {

            const searchText =
                $(this)
                    .val()
                    .toLowerCase()
                    .trim();


            if (
                searchText === ""
            ) {

                $(".message-row")
                    .show();

                return;

            }


            $(".message-row").each(
                function () {

                    const messageText =
                        $(this)
                            .find("p")
                            .text()
                            .toLowerCase();


                    $(this).toggle(
                        messageText.includes(
                            searchText
                        )
                    );

                }
            );

        }
    );


    // =========================================================
    // MORE MENU
    // =========================================================

    $("#chatMoreButton").on(
        "click",
        function (event) {

            event.stopPropagation();


            $("#chatMoreMenu")
                .toggleClass(
                    "active"
                );


            $("#attachmentMenu")
                .removeClass(
                    "active"
                );


            $("#emojiMenu")
                .removeClass(
                    "active"
                );

        }
    );


    // =========================================================
    // ATTACHMENT MENU
    // =========================================================

    $("#attachmentButton").on(
        "click",
        function (event) {

            event.stopPropagation();


            $("#attachmentMenu")
                .toggleClass(
                    "active"
                );


            $("#chatMoreMenu")
                .removeClass(
                    "active"
                );


            $("#emojiMenu")
                .removeClass(
                    "active"
                );

        }
    );


    // =========================================================
    // CLOSE MENUS
    // =========================================================

    $(document).on(
        "click",
        function () {

            $("#chatMoreMenu")
                .removeClass(
                    "active"
                );


            $("#attachmentMenu")
                .removeClass(
                    "active"
                );


            $("#emojiMenu")
                .removeClass(
                    "active"
                );

        }
    );


    // =========================================================
    // MENU CLICK
    // =========================================================

    $(
        "#chatMoreMenu, #attachmentMenu, #emojiMenu"
    ).on(
        "click",
        function (event) {

            event.stopPropagation();

        }
    );


    // =========================================================
    // PHOTO
    // =========================================================

    $("#photoButton").on(
        "click",
        function () {

            $("#fileInput").attr(
                "accept",
                "image/*"
            );


            $("#fileInput")
                .trigger(
                    "click"
                );

        }
    );


    // =========================================================
    // FILE
    // =========================================================

    $("#fileButton").on(
        "click",
        function () {

            $("#fileInput").attr(
                "accept",
                "*/*"
            );


            $("#fileInput")
                .trigger(
                    "click"
                );

        }
    );


    // =========================================================
    // FILE SELECTED
    // =========================================================

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


            $(this).val("");

        }
    );


    // =========================================================
    // MUTE CHAT
    // =========================================================

    $("#muteChatButton").on(
        "click",
        function () {

            $("#chatMoreMenu")
                .removeClass(
                    "active"
                );


            console.log(
                "Bildirişlər susduruldu."
            );

        }
    );


    // =========================================================
    // CLEAR CHAT
    // =========================================================

    $("#clearChatButton").on(
        "click",
        function () {

            $("#chatMoreMenu")
                .removeClass(
                    "active"
                );


            console.log(
                "Söhbəti təmizlə düyməsi."
            );

        }
    );


    // =========================================================
    // BLOCK USER
    // =========================================================

    $("#blockUserButton").on(
        "click",
        function () {

            $("#chatMoreMenu")
                .removeClass(
                    "active"
                );


            console.log(
                "Əməkdaş bloklama düyməsi."
            );

        }
    );


    // =========================================================
    // ESC KEY
    // =========================================================

    $(document).on(
        "keydown",
        function (event) {

            if (
                event.key !== "Escape"
            ) {
                return;
            }


            $("#chatSearchBox")
                .removeClass(
                    "active"
                );


            $("#chatMoreMenu")
                .removeClass(
                    "active"
                );


            $("#attachmentMenu")
                .removeClass(
                    "active"
                );


            $("#emojiMenu")
                .removeClass(
                    "active"
                );


            $("#messageSearch")
                .val("");


            $(".message-row")
                .show();

        }
    );


    // =========================================================
    // EMOJI MENU
    // =========================================================

    $("#emojiButton").on(
        "click",
        function (event) {

            event.stopPropagation();


            $("#emojiMenu")
                .toggleClass(
                    "active"
                );


            $("#chatMoreMenu")
                .removeClass(
                    "active"
                );


            $("#attachmentMenu")
                .removeClass(
                    "active"
                );

        }
    );


    // =========================================================
    // SELECT EMOJI
    // =========================================================

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
                text.substring(
                    0,
                    start
                ) +
                emoji +
                text.substring(
                    end
                );


            textarea.selectionStart =
                start +
                emoji.length;


            textarea.selectionEnd =
                start +
                emoji.length;


            $("#messageInput")
                .trigger(
                    "input"
                );


            textarea.focus();

        }
    );


    // =========================================================
    // CHECK NEW MESSAGES
    // =========================================================

    function checkNewMessages() {

        apiRequest({

            url:
                API_URL +
                "/api/conversations/" +
                conversationId +
                "/messages/",

            type:
                "GET",


            success:
                function (messages) {

                    if (
                        !Array.isArray(messages) ||
                        !messages.length
                    ) {
                        return;
                    }


                    let addedNewMessage =
                        false;


                    messages.forEach(
                        function (message) {

                            if (
                                !message ||
                                !message.id
                            ) {
                                return;
                            }


                            const messageId =
                                String(
                                    message.id
                                );


                            /*
                             * API-dən gələn mesajı
                             * həmişə cache-də saxla.
                             */
                            saveMessageToDB(
                                message
                            );


                            liveMessages.set(
                                messageId,
                                message
                            );


                            if (
                                renderedMessageIds.has(
                                    messageId
                                )
                            ) {
                                return;
                            }


                            const optimisticElement =
                                findOptimisticMessage(
                                    message
                                );


                            if (
                                optimisticElement
                            ) {

                                optimisticElement.remove();

                            }


                            renderMessage(
                                message
                            );


                            addedNewMessage = true;

                        }
                    );


                    if (
                        addedNewMessage
                    ) {

                        scrollToBottom();

                    }

                },


            error:
                function (xhr) {

                    console.log(
                        "Yeni mesajlar yoxlanılmadı:",
                        xhr.responseText
                    );

                }

        });

    }


    // =========================================================
    // INITIAL START
    // =========================================================

    /*
     * Əvvəl istifadəçi məlumatını API-dən yoxla.
     */
    loadConversation();


    /*
     * WebSocket müstəqil şəkildə dərhal açılsın.
     */
    connectWebSocket();


    /*
     * MESAJLARI BURADA ÇAĞIRMIRIQ.
     *
     * loadMessagesFromDB() tamamlandıqdan sonra
     * özü loadMessages() çağırır.
     *
     * Beləliklə:
     *
     * IndexedDB
     *      ↓
     * ekran
     *      ↓
     * API
     *
     * ardıcıllığı qorunur.
     */

});