$(document).ready(function () {

    // =========================================================
    // CONFIGURATION
    // =========================================================

    const DB_NAME = "DMS_DB";

    /*
     * Version 6:
     *
     * Köhnə IndexedDB-də qalmış optimistic/non-numeric
     * mesajların təmizlənməsi üçün version artırılıb.
     */
    const DB_VERSION = 8;

    const MESSAGE_STORE = "messages";
    const CONVERSATION_STORE = "conversations";
    const PENDING_MESSAGE_STORE = "pendingMessages";


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

    /*
     * YALNIZ real server message ID-ləri burada saxlanılır.
     *
     * client_xxx ID-ləri buraya daxil edilmir.
     */
    const renderedMessageIds =
        new Set();


    /*
     * Real server mesajlarının memory cache-i.
     */
    const liveMessages =
        new Map();


    /*
     * WebSocket hazır olmayanda göndəriləcək mesajlar.
     */
    let pendingMessages = [];


    let socket = null;

    let reconnectTimer = null;

    let presenceTimer = null;


    let isInitialLoading = true;

    let loadingOlderMessages = false;

    let oldestMessageId = null;

    let hasMoreMessages = true;


    // =========================================================
    // INDEXEDDB
    // =========================================================

    let db = null;

    let dbReadyResolve;

    const dbReadyPromise = new Promise(
        function (resolve) {
            dbReadyResolve = resolve;
        }
    );


    // =========================================================
    // DATABASE OPEN
    // =========================================================

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


            // -------------------------------------------------
            // MESSAGE STORE
            // -------------------------------------------------

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


            // -------------------------------------------------
            // CONVERSATION STORE
            // -------------------------------------------------

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

            // -------------------------------------------------
            // PENDING MESSAGE STORE
            // -------------------------------------------------

            if (!db.objectStoreNames.contains(PENDING_MESSAGE_STORE)) {
                const store = db.createObjectStore(
                    PENDING_MESSAGE_STORE,
                    { keyPath: "client_id" }
                );

                store.createIndex(
                    "conversationId",
                    "conversationId",
                    { unique: false }
                );
            }


            // -------------------------------------------------
            // CLEAN INVALID OLD MESSAGE RECORDS
            // -------------------------------------------------

            const transaction =
                event.target.transaction;


            if (
                transaction &&
                db.objectStoreNames.contains(
                    MESSAGE_STORE
                )
            ) {

                const store =
                    transaction.objectStore(
                        MESSAGE_STORE
                    );


                const request =
                    store.openCursor();


                request.onsuccess =
                    function (cursorEvent) {

                        const cursor =
                            cursorEvent.target.result;


                        if (!cursor) {
                            return;
                        }


                        const message =
                            cursor.value;


                        const numericId =
                            Number(
                                message &&
                                message.id
                            );


                        /*
                         * Real server message ID-ləri
                         * numeric olmalıdır.
                         *
                         * client_xxx kimi köhnə
                         * optimistic ID-lər silinir.
                         */
                        if (
                            !Number.isFinite(
                                numericId
                            )
                        ) {

                            cursor.delete();

                        }


                        cursor.continue();

                    };

            }

        };


    // =========================================================
    // INDEXEDDB SUCCESS
    // =========================================================

    dbRequest.onsuccess = function (event) {

        db = event.target.result;


        db.onversionchange = function () {
            db.close();
        };


        // IndexedDB artıq tam hazırdır.
        dbReadyResolve(db);


        loadConversationFromDB();
        loadMessagesFromDB();
        loadPendingMessagesFromDB();
    };

    // =========================================================
    // INDEXEDDB ERROR
    // =========================================================

    dbRequest.onerror =
        function (event) {

            console.warn(
                "IndexedDB xətası:",
                event.target.error
            );

        };


    // =========================================================
    // MESSAGE VALIDATION
    // =========================================================

    function isRealServerMessage(message) {

        if (!message) {
            return false;
        }


        if (
            message.id === undefined ||
            message.id === null ||
            message.id === ""
        ) {
            return false;
        }


        return Number.isFinite(
            Number(message.id)
        );

    }


    // =========================================================
    // MESSAGE ID
    // =========================================================

    function getMessageId(message) {

        if (
            !isRealServerMessage(message)
        ) {
            return null;
        }


        return Number(
            message.id
        );

    }


    // =========================================================
    // MESSAGE TIMESTAMP
    // =========================================================

    function getMessageTimestamp(message) {

        if (!message) {
            return 0;
        }


        const timestamp =
            new Date(
                message.created_at || 0
            ).getTime();


        return Number.isFinite(timestamp)
            ? timestamp
            : 0;

    }


    // =========================================================
    // SAVE MESSAGE TO INDEXEDDB
    // =========================================================

    function saveMessageToDB(message) {

        if (
            !db ||
            !message ||
            message.optimistic
        ) {
            return;
        }


        if (
            !isRealServerMessage(
                message
            )
        ) {
            return;
        }


        const messageId =
            getMessageId(
                message
            );


        if (messageId === null) {
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
                messageId,

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

                console.warn(
                    "Mesaj IndexedDB-yə yazılmadı:",
                    event.target.error
                );

            };

    }

    // =========================================================
    // PENDING MESSAGE → INDEXEDDB
    // =========================================================

    function savePendingMessageToDB(message) {

        if (!message || !message.client_id) {
            return Promise.resolve(false);
        }


        return dbReadyPromise.then(
            function () {

                if (!db) {
                    return false;
                }


                const pendingMessage = {

                    client_id:
                        String(
                            message.client_id
                        ),

                    conversationId:
                        String(
                            conversationId
                        ),

                    sender:
                        message.sender ||
                        currentUser,

                    content:
                        message.content || "",

                    created_at:
                        message.created_at ||
                        new Date().toISOString(),

                    optimistic:
                        true
                };


                try {

                    return new Promise(
                        function (resolve) {

                            const transaction =
                                db.transaction(
                                    PENDING_MESSAGE_STORE,
                                    "readwrite"
                                );


                            const store =
                                transaction.objectStore(
                                    PENDING_MESSAGE_STORE
                                );


                            const request =
                                store.put(
                                    pendingMessage
                                );


                            request.onsuccess =
                                function () {

                                    resolve(true);

                                };


                            request.onerror =
                                function () {

                                    console.error(
                                        "Pending mesaj IndexedDB-yə yazılmadı:",
                                        request.error
                                    );

                                    resolve(false);

                                };

                        }
                    );

                } catch (error) {

                    console.error(
                        "Pending mesaj IndexedDB xətası:",
                        error
                    );

                    return false;
                }

            }
        );

    }

    function loadPendingMessagesFromDB() {

        if (!db) {
            return;
        }

        try {

            const transaction = db.transaction(
                PENDING_MESSAGE_STORE,
                "readonly"
            );

            const store = transaction.objectStore(
                PENDING_MESSAGE_STORE
            );

            const index = store.index("conversationId");

            const request = index.getAll(
                String(conversationId)
            );

            request.onsuccess = function () {

                const messages = request.result || [];

                messages.sort(function (a, b) {
                    return (
                        getMessageTimestamp(a) -
                        getMessageTimestamp(b)
                    );
                });

                messages.forEach(function (message) {

                    if (!message.client_id) {
                        return;
                    }

                    // Eyni optimistic mesajı ikinci dəfə yaratma
                    const existing = $messagesArea.find(
                        `.message-row[data-client-id="${escapeHtmlAttribute(message.client_id)}"]`
                    );

                    if (existing.length) {
                        return;
                    }

                    renderMessage({
                        ...message,
                        id: message.client_id,
                        optimistic: true
                    });
                });

                if (messages.length) {
                    scrollToBottom();
                }
            };

            request.onerror = function () {

                console.warn(
                    "Pending mesajlar IndexedDB-dən oxunmadı:",
                    request.error
                );
            };

        } catch (error) {

            console.error(
                "Pending mesajlar yüklənərkən xəta:",
                error
            );
        }
    }

    function deletePendingMessageFromDB(clientId) {

        if (!db || !clientId) {
            return;
        }

        try {

            const transaction = db.transaction(
                PENDING_MESSAGE_STORE,
                "readwrite"
            );

            const store = transaction.objectStore(
                PENDING_MESSAGE_STORE
            );

            store.delete(String(clientId));

        } catch (error) {

            console.error(
                "Pending mesaj IndexedDB-dən silinmədi:",
                error
            );
        }
    }


    // =========================================================
    // SAVE CONVERSATION TO INDEXEDDB
    // =========================================================

    function saveConversationToDB(
        otherUser
    ) {

        if (
            !db ||
            !otherUser
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

                console.warn(
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


                /*
                 * İstifadəçi adı API-ni gözləmədən
                 * dərhal göstərilir.
                 */
                renderChatUser(
                    cachedConversation.user
                );

            };


        request.onerror =
            function (event) {

                console.warn(
                    "Cache user oxunmadı:",
                    event.target.error
                );

            };

    }


    // =========================================================
    // LOAD MESSAGES FROM INDEXEDDB
    // =========================================================

    function loadMessagesFromDB() {

        if (!db) {
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


                const validMessages =
                    messages
                        .filter(
                            function (message) {

                                return (
                                    isRealServerMessage(
                                        message
                                    ) &&
                                    !message.optimistic
                                );

                            }
                        )
                        .sort(
                            function (a, b) {

                                return (
                                    getMessageTimestamp(a) -
                                    getMessageTimestamp(b)
                                );

                            }
                        );


                /*
                 * Son 20 mesajı cache-dən göstər.
                 */
                const lastMessages =
                    validMessages.slice(-20);


                lastMessages.forEach(
                    function (message) {

                        insertServerMessageInOrder(
                            message,
                            false
                        );

                    }
                );


                if (
                    lastMessages.length
                ) {

                    oldestMessageId =
                        lastMessages[0].id;

                }


                /*
                 * Cache ekrana gəlibsə,
                 * artıq initial loading bitib.
                 */
                isInitialLoading = false;


                requestAnimationFrame(
                    function () {

                        if (
                            lastMessages.length
                        ) {

                            scrollToBottom();

                        }

                    }
                );

            };


        request.onerror =
            function (event) {

                console.warn(
                    "IndexedDB mesajları oxunmadı:",
                    event.target.error
                );


                isInitialLoading = false;

            };

    }


    // =========================================================
    // RENDER CHAT USER
    // =========================================================

    function renderChatUser(
        otherUser
    ) {

        if (!otherUser) {
            return;
        }


        // -----------------------------------------------------
        // NAME
        // -----------------------------------------------------

        let fullName =
            (
                (otherUser.first_name || "") +
                " " +
                (otherUser.last_name || "")
            ).trim();


        if (!fullName) {

            fullName =
                otherUser.username ||
                "İstifadəçi";

        }


        $("#chatUserName")
            .text(fullName);


        // -----------------------------------------------------
        // AVATAR
        // -----------------------------------------------------

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


        // -----------------------------------------------------
        // STATUS
        // -----------------------------------------------------

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
    // LOAD CONVERSATION FROM API
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

                    if (
                        !Array.isArray(
                            conversations
                        )
                    ) {
                        return;
                    }


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

                        window.location.href =
                            "chats.html";

                        return;

                    }


                    let otherUser = null;


                    if (
                        Array.isArray(
                            conversation.participants
                        )
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


                    /*
                     * API məlumatı cache-dəkinin
                     * üzərinə yazır və UI-ni yeniləyir.
                     */
                    renderChatUser(
                        otherUser
                    );


                    saveConversationToDB(
                        otherUser
                    );

                },


            error:
                function (xhr) {

                    console.warn(
                        "Söhbət API-dən yüklənmədi:",
                        xhr.responseText
                    );

                }

        });

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

                    if (
                        !Array.isArray(
                            messages
                        )
                    ) {

                        isInitialLoading = false;

                        return;

                    }


                    const serverMessages =
                        messages
                            .filter(
                                isRealServerMessage
                            )
                            .sort(
                                function (a, b) {

                                    return (
                                        getMessageTimestamp(a) -
                                        getMessageTimestamp(b)
                                    );

                                }
                            )
                            .slice(-20);


                    serverMessages.forEach(
                        function (message) {

                            saveMessageToDB(
                                message
                            );


                            /*
                             * Optimistic varsa əvvəl
                             * onunla reconcile edilir.
                             */
                            if (
                                reconcileOptimisticMessage(
                                    message
                                )
                            ) {

                                return;

                            }


                            /*
                             * Artıq ekrandadırsa duplicate
                             * yaratmırıq.
                             */
                            insertServerMessageInOrder(
                                message,
                                false
                            );

                        }
                    );


                    if (
                        serverMessages.length
                    ) {

                        oldestMessageId =
                            serverMessages[0].id;

                    }


                    hasMoreMessages =
                        serverMessages.length === 20;


                    isInitialLoading = false;


                    /*
                     * API ilk açılışda gəlibsə
                     * chat aşağıda qalsın.
                     */
                    requestAnimationFrame(
                        function () {

                            scrollToBottom();

                        }
                    );

                },


            error:
                function (xhr) {

                    console.warn(
                        "Mesajlar API-dən yüklənmədi:",
                        xhr.responseText
                    );


                    isInitialLoading = false;

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


        const optimisticClass =
            message.optimistic
                ? " optimistic-message"
                : "";


        const messageId =
            message.id || "";


        const clientId =
            message.client_id || "";


        const createdAt =
            message.created_at || "";


        const $message =
            $(`
                <div
                    class="message-row ${messageClass}${optimisticClass}"
                    data-message-id="${escapeHtmlAttribute(messageId)}"
                    data-client-id="${escapeHtmlAttribute(clientId)}"
                    data-created-at="${escapeHtmlAttribute(createdAt)}"
                >

                    <div class="message-bubble">

                        <p></p>

                        <div class="message-meta">

                            <time></time>

                            ${isSent
                    ? '<i class="fa-solid fa-check message-read"></i>'
                    : ''
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
                formatMessageTime(
                    message.created_at
                )
            );


        return $message;

    }


    // =========================================================
    // INSERT SERVER MESSAGE IN ORDER
    // =========================================================

    function insertServerMessageInOrder(
        message,
        saveToDB = true
    ) {

        if (
            !isRealServerMessage(
                message
            )
        ) {
            return false;
        }


        const messageId =
            String(
                message.id
            );


        /*
         * Duplicate.
         */
        if (
            renderedMessageIds.has(
                messageId
            )
        ) {

            return false;

        }


        const messageTimestamp =
            getMessageTimestamp(
                message
            );


        const $message =
            createMessageElement(
                message
            );


        let inserted = false;


        const $rows =
            $messagesArea.find(
                ".message-row"
            );


        $rows.each(
            function () {

                if (inserted) {
                    return;
                }


                const $row =
                    $(this);


                /*
                 * Optimistic mesajın vaxtı varsa,
                 * onunla da müqayisə edirik.
                 */
                const rowTimestamp =
                    new Date(
                        $row.attr(
                            "data-created-at"
                        ) || 0
                    ).getTime();


                if (
                    Number.isFinite(
                        rowTimestamp
                    ) &&
                    rowTimestamp >
                    messageTimestamp
                ) {

                    $message.insertBefore(
                        $row
                    );


                    inserted = true;

                }

            }
        );


        if (!inserted) {

            $messagesArea.append(
                $message
            );

        }


        renderedMessageIds.add(
            messageId
        );


        liveMessages.set(
            messageId,
            message
        );


        if (saveToDB) {

            saveMessageToDB(
                message
            );

        }


        return true;

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


        // -----------------------------------------------------
        // 1. EXACT CLIENT ID
        // -----------------------------------------------------

        const serverClientId =
            serverMessage.client_id;


        if (serverClientId) {

            const $messages =
                $messagesArea.find(
                    ".optimistic-message"
                );


            for (
                let i = 0;
                i < $messages.length;
                i++
            ) {

                const $item =
                    $($messages[i]);


                if (
                    String(
                        $item.attr(
                            "data-client-id"
                        )
                    ) ===
                    String(
                        serverClientId
                    )
                ) {

                    return $item;

                }

            }

        }


        // -----------------------------------------------------
        // 2. ONLY OUR OWN MESSAGES
        // -----------------------------------------------------

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


        // -----------------------------------------------------
        // 3. FIFO CONTENT FALLBACK
        // -----------------------------------------------------

        const optimisticMessages =
            $messagesArea
                .find(
                    ".optimistic-message"
                )
                .toArray();


        const serverContent =
            String(
                serverMessage.content || ""
            ).trim();


        for (
            let i = 0;
            i < optimisticMessages.length;
            i++
        ) {

            const $item =
                $(
                    optimisticMessages[i]
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
    // RECONCILE OPTIMISTIC MESSAGE
    // =========================================================

    function reconcileOptimisticMessage(
        serverMessage
    ) {

        if (
            !isRealServerMessage(
                serverMessage
            )
        ) {
            return false;
        }


        // -----------------------------------------------------
        // CLIENT ID
        // -----------------------------------------------------

        const clientId =
            serverMessage.client_id
                ? String(serverMessage.client_id)
                : null;


        // -----------------------------------------------------
        // FIND OPTIMISTIC MESSAGE
        // -----------------------------------------------------

        const $optimistic =
            findOptimisticMessage(
                serverMessage
            );


        // -----------------------------------------------------
        // SERVER MESSAGE ID
        // -----------------------------------------------------

        const serverMessageId =
            String(
                serverMessage.id
            );


        // -----------------------------------------------------
        // IF ALREADY RENDERED
        // -----------------------------------------------------

        if (
            renderedMessageIds.has(
                serverMessageId
            )
        ) {

            if ($optimistic && $optimistic.length) {

                $optimistic.remove();

            }


            /*
             * Server mesajı artıq ekrandadır.
             * Pending record artıq lazım deyil.
             */

            if (clientId) {

                deletePendingMessageFromDB(
                    clientId
                );

            }


            return true;

        }


        // -----------------------------------------------------
        // NO OPTIMISTIC MESSAGE IN DOM
        // -----------------------------------------------------

        /*
         * Bu vəziyyət reload zamanı yarana bilər.
         *
         * Məsələn:
         *
         * IndexedDB pending mesajı var,
         * amma API/WebSocket cavabı DOM-a
         * pending mesaj render olunmazdan əvvəl gəlib.
         *
         * Buna görə client_id varsa pending record-u
         * yenə də silirik.
         */

        if (
            !$optimistic ||
            !$optimistic.length
        ) {

            if (clientId) {

                deletePendingMessageFromDB(
                    clientId
                );

            }


            return false;

        }


        // -----------------------------------------------------
        // UPDATE DOM
        // -----------------------------------------------------

        $optimistic

            .removeClass(
                "optimistic-message"
            )

            .attr(
                "data-message-id",
                serverMessageId
            )

            .attr(
                "data-client-id",
                clientId ||
                $optimistic.attr(
                    "data-client-id"
                ) ||
                ""
            )

            .attr(
                "data-created-at",
                serverMessage.created_at || ""
            );


        // -----------------------------------------------------
        // CONTENT
        // -----------------------------------------------------

        $optimistic
            .find("p")
            .text(
                serverMessage.content || ""
            );


        // -----------------------------------------------------
        // TIME
        // -----------------------------------------------------

        $optimistic
            .find("time")
            .text(
                formatMessageTime(
                    serverMessage.created_at
                )
            );


        // -----------------------------------------------------
        // SENT / RECEIVED CLASS
        // -----------------------------------------------------

        const senderId =
            serverMessage.sender &&
            serverMessage.sender.id;


        const currentUserId =
            currentUser &&
            currentUser.id;


        const isSent =
            String(senderId) ===
            String(currentUserId);


        $optimistic
            .removeClass(
                "sent received"
            )
            .addClass(
                isSent
                    ? "sent"
                    : "received"
            );


        // -----------------------------------------------------
        // CHECK ICON
        // -----------------------------------------------------

        if (
            isSent &&
            !$optimistic.find(
                ".message-read"
            ).length
        ) {

            $optimistic
                .find(
                    ".message-meta"
                )
                .append(
                    '<i class="fa-solid fa-check message-read"></i>'
                );

        }


        // -----------------------------------------------------
        // STATE
        // -----------------------------------------------------

        renderedMessageIds.add(
            serverMessageId
        );


        liveMessages.set(
            serverMessageId,
            serverMessage
        );


        // -----------------------------------------------------
        // SAVE REAL SERVER MESSAGE
        // -----------------------------------------------------

        saveMessageToDB(
            serverMessage
        );


        // -----------------------------------------------------
        // DELETE PENDING MESSAGE
        // -----------------------------------------------------

        if (clientId) {

            deletePendingMessageFromDB(
                clientId
            );

        }


        return true;

    }


    // =========================================================
    // RENDER MESSAGE
    // =========================================================

    function renderMessage(
        message
    ) {

        if (!message) {
            return;
        }


        if (message.optimistic) {

            const $message =
                createMessageElement(
                    message
                );


            $messagesArea.append(
                $message
            );


            return;

        }


        insertServerMessageInOrder(
            message
        );

    }


    // =========================================================
    // ESCAPE ATTRIBUTE
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
                hour: "2-digit",
                minute: "2-digit"
            }
        );

    }


    // =========================================================
    // LAST SEEN
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
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit"
            }
        );

    }


    // =========================================================
    // SEND MESSAGE
    // =========================================================

    // =========================================================
    // SEND MESSAGE
    // =========================================================

    async function sendMessage() {

        const message =
            $messageInput
                .val()
                .trim();


        if (!message) {
            return;
        }


        // =====================================================
        // CLIENT ID
        // =====================================================

        const clientId =
            "client_" +
            Date.now() +
            "_" +
            Math.random()
                .toString(36)
                .substring(2, 9);


        // =====================================================
        // INPUT TƏMİZLƏ
        // =====================================================

        $messageInput.val("");

        $messageInput.css(
            "height",
            "auto"
        );


        // =====================================================
        // OPTIMISTIC MESSAGE
        // =====================================================

        const optimisticMessage = {

            id:
                clientId,

            client_id:
                clientId,

            conversationId:
                String(
                    conversationId
                ),

            sender:
                currentUser,

            content:
                message,

            created_at:
                new Date().toISOString(),

            optimistic:
                true
        };


        // =====================================================
        // UI-DƏ DƏRHAL GÖSTƏR
        // =====================================================

        renderMessage(
            optimisticMessage
        );


        scrollToBottom();


        // =====================================================
        // INDEXEDDB-YƏ SAXLA
        // =====================================================

        await savePendingMessageToDB(
            optimisticMessage
        );


        // =====================================================
        // SOCKET AÇIQDIRSA DƏRHAL GÖNDƏR
        // =====================================================

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

                console.warn(
                    "Mesaj WebSocket-ə göndərilmədi:",
                    error
                );

                connectWebSocket();

            }

            return;
        }


        // =====================================================
        // SOCKET AÇIQ DEYİLSƏ
        // =====================================================

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
    // ENTER SEND
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
                ) + "px";

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
    // NEAR BOTTOM
    // =========================================================

    function isNearBottom() {

        const element =
            $messagesArea[0];


        if (!element) {
            return true;
        }


        const distance =
            element.scrollHeight -
            element.scrollTop -
            element.clientHeight;


        return distance <= 100;

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
                        !Array.isArray(
                            messages
                        ) ||
                        !messages.length
                    ) {

                        hasMoreMessages = false;

                        loadingOlderMessages = false;

                        return;

                    }


                    const validMessages =
                        messages
                            .filter(
                                isRealServerMessage
                            )
                            .sort(
                                function (a, b) {

                                    return (
                                        getMessageTimestamp(a) -
                                        getMessageTimestamp(b)
                                    );

                                }
                            );


                    if (
                        !validMessages.length
                    ) {

                        loadingOlderMessages = false;

                        return;

                    }


                    oldestMessageId =
                        validMessages[0].id;


                    if (
                        validMessages.length < 20
                    ) {

                        hasMoreMessages = false;

                    }


                    for (
                        let i =
                            validMessages.length - 1;

                        i >= 0;

                        i--
                    ) {

                        const message =
                            validMessages[i];


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


                            const difference =
                                newScrollHeight -
                                oldScrollHeight;


                            element.scrollTop =
                                oldScrollTop +
                                difference;


                            loadingOlderMessages =
                                false;

                        }
                    );

                },


            error:
                function (xhr) {

                    console.warn(
                        "Köhnə mesajlar yüklənmədi:",
                        xhr.responseText
                    );


                    loadingOlderMessages = false;

                }

        });

    }


    // =========================================================
    // SCROLL EVENT
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
    // WEBSOCKET CONNECT
    // =========================================================

    function connectWebSocket() {

        if (
            socket &&
            (
                socket.readyState ===
                WebSocket.OPEN ||

                socket.readyState ===
                WebSocket.CONNECTING
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

            return;

        }


        const protocol =
            window.location.protocol ===
                "https:"
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


        const newSocket =
            new WebSocket(
                wsUrl
            );


        socket =
            newSocket;


        // -----------------------------------------------------
        // OPEN
        // -----------------------------------------------------

        newSocket.onopen =
            function () {

                if (
                    socket !== newSocket
                ) {

                    return;

                }


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


        // -----------------------------------------------------
        // MESSAGE
        // -----------------------------------------------------

        newSocket.onmessage =
            function (event) {

                if (
                    socket !== newSocket
                ) {

                    return;

                }


                let data;


                try {

                    data =
                        JSON.parse(
                            event.data
                        );

                } catch (error) {

                    console.warn(
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


                if (
                    !isRealServerMessage(
                        message
                    )
                ) {

                    return;

                }


                const reconciled =
                    reconcileOptimisticMessage(
                        message
                    );


                if (reconciled) {

                    return;

                }


                const shouldScroll =
                    isNearBottom();


                const inserted =
                    insertServerMessageInOrder(
                        message
                    );


                if (
                    inserted &&
                    shouldScroll
                ) {

                    scrollToBottom();

                }

            };


        // -----------------------------------------------------
        // CLOSE
        // -----------------------------------------------------

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


                scheduleReconnect();

            };


        // -----------------------------------------------------
        // ERROR
        // -----------------------------------------------------

        newSocket.onerror =
            function (error) {

                if (
                    socket !== newSocket
                ) {

                    return;

                }


                console.warn(
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

            console.warn(
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
            socket.readyState !== WebSocket.OPEN
        ) {
            return;
        }


        // =====================================================
        // INDEXEDDB YOXDURSA GÖZLƏ
        // =====================================================

        if (!db) {
            return;
        }


        try {

            const transaction =
                db.transaction(
                    PENDING_MESSAGE_STORE,
                    "readonly"
                );


            const store =
                transaction.objectStore(
                    PENDING_MESSAGE_STORE
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

                    const pendingMessages =
                        request.result || [];


                    // -------------------------------------------------
                    // TARİXƏ GÖRƏ SIRALA
                    // -------------------------------------------------

                    pendingMessages.sort(
                        function (a, b) {

                            return (
                                getMessageTimestamp(a) -
                                getMessageTimestamp(b)
                            );

                        }
                    );


                    // -------------------------------------------------
                    // HAMISINI SERVERƏ GÖNDƏR
                    // -------------------------------------------------

                    pendingMessages.forEach(
                        function (item) {

                            if (
                                !item ||
                                !item.client_id ||
                                !item.content
                            ) {
                                return;
                            }


                            // Socket bu anda bağlanıbsa
                            // qalanları göndərməyə çalışma.

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

                                        message:
                                            item.content,

                                        client_id:
                                            String(
                                                item.client_id
                                            )

                                    })
                                );

                            } catch (error) {

                                console.warn(
                                    "Pending mesaj WebSocket-ə göndərilmədi:",
                                    error
                                );

                            }

                        }
                    );

                };


            request.onerror =
                function () {

                    console.warn(
                        "Pending mesajlar IndexedDB-dən oxunmadı:",
                        request.error
                    );

                };


        } catch (error) {

            console.error(
                "Pending mesajlar göndərilərkən xəta:",
                error
            );

        }

    }


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
                        !Array.isArray(
                            messages
                        )
                    ) {

                        return;

                    }


                    const shouldScroll =
                        isNearBottom();


                    let added =
                        false;


                    messages
                        .filter(
                            isRealServerMessage
                        )
                        .sort(
                            function (a, b) {

                                return (
                                    getMessageTimestamp(a) -
                                    getMessageTimestamp(b)
                                );

                            }
                        )
                        .forEach(
                            function (message) {

                                saveMessageToDB(
                                    message
                                );


                                if (
                                    reconcileOptimisticMessage(
                                        message
                                    )
                                ) {

                                    added = true;

                                    return;

                                }


                                const inserted =
                                    insertServerMessageInOrder(
                                        message,
                                        false
                                    );


                                if (inserted) {

                                    added = true;

                                }

                            }
                        );


                    if (
                        added &&
                        shouldScroll
                    ) {

                        scrollToBottom();

                    }

                },


            error:
                function (xhr) {

                    console.warn(
                        "Yeni mesajlar yoxlanılmadı:",
                        xhr.responseText
                    );

                }

        });

    }


    // =========================================================
    // VISIBILITY CHANGE & CLEANUP (10/10 FIX)
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


    /*
     * Memory leak-lərin qarşısını almaq üçün
     * səhifədən çıxıldıqda timer və socket təmizlənir.
     */
    window.addEventListener(
        "beforeunload",
        function () {

            if (presenceTimer) {
                clearInterval(presenceTimer);
            }

            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
            }

            if (socket) {
                socket.close();
            }

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
    // SEARCH
    // =========================================================

    $("#chatSearchButton").on(
        "click",
        function () {

            $("#chatSearchBox")
                .addClass("active");


            $("#messageSearch")
                .trigger("focus");

        }
    );


    $("#closeChatSearch").on(
        "click",
        function () {

            $("#messageSearch")
                .val("");


            $(".message-row")
                .show();


            $("#chatSearchBox")
                .removeClass("active");

        }
    );


    $("#messageSearch").on(
        "input",
        function () {

            const searchText =
                $(this)
                    .val()
                    .toLowerCase()
                    .trim();


            if (!searchText) {

                $(".message-row")
                    .show();

                return;

            }


            $(".message-row").each(
                function () {

                    const text =
                        $(this)
                            .find("p")
                            .text()
                            .toLowerCase();


                    $(this).toggle(
                        text.includes(
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
                .toggleClass("active");


            $("#attachmentMenu")
                .removeClass("active");


            $("#emojiMenu")
                .removeClass("active");

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
                .toggleClass("active");


            $("#chatMoreMenu")
                .removeClass("active");


            $("#emojiMenu")
                .removeClass("active");

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
                .toggleClass("active");


            $("#chatMoreMenu")
                .removeClass("active");


            $("#attachmentMenu")
                .removeClass("active");

        }
    );


    // =========================================================
    // CLOSE MENUS
    // =========================================================

    $(document).on(
        "click",
        function () {

            $("#chatMoreMenu")
                .removeClass("active");


            $("#attachmentMenu")
                .removeClass("active");


            $("#emojiMenu")
                .removeClass("active");

        }
    );


    $(
        "#chatMoreMenu, #attachmentMenu, #emojiMenu"
    ).on(
        "click",
        function (event) {

            event.stopPropagation();

        }
    );


    // =========================================================
    // PHOTO & FILE
    // =========================================================

    $("#photoButton").on(
        "click",
        function () {

            $("#fileInput")
                .attr(
                    "accept",
                    "image/*"
                )
                .trigger("click");

        }
    );


    $("#fileButton").on(
        "click",
        function () {

            $("#fileInput")
                .attr(
                    "accept",
                    "*/*"
                )
                .trigger("click");

        }
    );


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
    // MUTE, CLEAR & BLOCK
    // =========================================================

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


    // =========================================================
    // EMOJI SELECTION
    // =========================================================

    $(document).on(
        "click",
        ".emoji-item",
        function (event) {

            event.stopPropagation();


            const emoji =
                $(this).text();


            const textarea =
                $("#messageInput")[0];


            if (!textarea) {
                return;
            }


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
                .trigger("input");


            textarea.focus();

        }
    );


    // =========================================================
    // ESC
    // =========================================================

    $(document).on(
        "keydown",
        function (event) {

            if (
                event.key !==
                "Escape"
            ) {

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


            $("#messageSearch")
                .val("");


            $(".message-row")
                .show();

        }
    );


    // =========================================================
    // INITIALIZATION
    // =========================================================

    loadConversation();

    loadMessages();

    connectWebSocket();

});  