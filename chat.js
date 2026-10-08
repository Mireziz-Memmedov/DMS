$(document).ready(function () {

    // =========================================================
    // CONFIGURATION
    // =========================================================

    const DB_NAME = "DMS_DB";

    /*
     * Version 8
     *
     * messages
     * conversations
     * pendingMessages
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
     * Yalnız real server message ID-ləri.
     */
    const renderedMessageIds =
        new Set();


    /*
     * Real server mesajlarının memory cache-i.
     */
    const liveMessages =
        new Map();


    /*
     * IndexedDB hazırdır?
     */
    let db = null;


    /*
     * IndexedDB hazır olmasını gözləyən Promise.
     *
     * Əvvəlki kodda yalnız resolve var idi.
     * DB error olduqda Promise heç vaxt bitmirdi.
     */
    let dbReadyResolve;
    let dbReadyReject;

    const dbReadyPromise =
        new Promise(function (resolve, reject) {

            dbReadyResolve = resolve;
            dbReadyReject = reject;

        });


    /*
     * IndexedDB ilkin cache bir dəfə yüklənəcək.
     */
    let initialCacheLoaded = false;


    /*
     * Chat initialization yalnız bir dəfə.
     */
    let chatInitialized = false;


    // =========================================================
    // WEBSOCKET STATE
    // =========================================================

    let socket = null;

    let reconnectTimer = null;

    let presenceTimer = null;


    /*
     * WebSocket connection Promise.
     *
     * Eyni anda bir neçə connectWebSocket()
     * çağırılmasının qarşısını alır.
     */
    let socketConnectionPromise = null;


    /*
     * Socket bağlanarkən köhnə socket-in
     * event-lərinin yeni socket-ə qarışmaması üçün.
     */
    let socketGeneration = 0;


    // =========================================================
    // OUTGOING MESSAGE QUEUE
    // =========================================================

    /*
     * ÇOX VACİB:
     *
     * Artıq sendMessage() özü socket.send()
     * etmir.
     *
     * Bütün mesajlar:
     *
     * sendMessage()
     *      ↓
     * IndexedDB pending
     *      ↓
     * processOutgoingQueue()
     *      ↓
     * WebSocket
     *      ↓
     * ACK
     *
     * axını ilə gedir.
     */


    /*
     * Hazırda ACK gözlənilən client_id.
     */
    let waitingForAckClientId = null;


    /*
     * Hazırda ACK gözləyən Promise resolve/reject.
     */
    let waitingForAckResolve = null;
    let waitingForAckReject = null;


    /*
     * Queue işləyir?
     */
    let outgoingQueueRunning = false;


    /*
     * Queue yenidən işlədilməlidir?
     */
    let outgoingQueueRequested = false;


    /*
     * ACK timeout.
     *
     * Server çox gec cavab verərsə queue sonsuza qədər
     * bloklanmasın.
     */
    const ACK_TIMEOUT = 15000;


    // =========================================================
    // CHAT STATE
    // =========================================================

    let isInitialLoading = true;

    let loadingOlderMessages = false;

    let oldestMessageId = null;

    let hasMoreMessages = true;


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

            const database =
                event.target.result;

            db = database;


            // -------------------------------------------------
            // MESSAGE STORE
            // -------------------------------------------------

            if (
                !database.objectStoreNames.contains(
                    MESSAGE_STORE
                )
            ) {

                const store =
                    database.createObjectStore(
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
                !database.objectStoreNames.contains(
                    CONVERSATION_STORE
                )
            ) {

                database.createObjectStore(
                    CONVERSATION_STORE,
                    {
                        keyPath: "conversationId"
                    }
                );

            }


            // -------------------------------------------------
            // PENDING MESSAGE STORE
            // -------------------------------------------------

            if (
                !database.objectStoreNames.contains(
                    PENDING_MESSAGE_STORE
                )
            ) {

                const store =
                    database.createObjectStore(
                        PENDING_MESSAGE_STORE,
                        {
                            keyPath: "client_id"
                        }
                    );


                store.createIndex(
                    "conversationId",
                    "conversationId",
                    {
                        unique: false
                    }
                );

            }


            // -------------------------------------------------
            // CLEAN OLD INVALID MESSAGE RECORDS
            // -------------------------------------------------

            const transaction =
                event.target.transaction;


            if (
                transaction &&
                database.objectStoreNames.contains(
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
                         * client_xxx kimi köhnə optimistic
                         * ID-ləri silirik.
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

    dbRequest.onsuccess =
        function (event) {

            db =
                event.target.result;


            db.onversionchange =
                function () {

                    db.close();

                };


            dbReadyResolve(db);


            /*
             * Bütün cache-ləri bir yerdə yükləyirik.
             *
             * Əvvəlki kodda:
             *
             * loadConversationFromDB()
             * loadMessagesFromDB()
             * loadPendingMessagesFromDB()
             *
             * ayrıca işləyirdi.
             *
             * Bu isə DOM race yarada bilirdi.
             */
            loadInitialCache();

        };


    // =========================================================
    // INDEXEDDB ERROR
    // =========================================================

    dbRequest.onerror =
        function (event) {

            const error =
                event.target.error;


            console.warn(
                "IndexedDB xətası:",
                error
            );


            dbReadyReject(error);


            /*
             * DB işləməsə belə chat tam dayanmasın.
             */
            initializeChat();

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
    // CLIENT ID
    // =========================================================

    function generateClientId() {

        if (
            window.crypto &&
            typeof window.crypto.randomUUID === "function"
        ) {

            return (
                "client_" +
                window.crypto.randomUUID()
            );

        }


        return (
            "client_" +
            Date.now() +
            "_" +
            Math.random()
                .toString(36)
                .substring(2, 12)
        );

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
            !isRealServerMessage(message)
        ) {
            return;
        }


        const messageId =
            getMessageId(message);


        if (messageId === null) {
            return;
        }


        try {

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
                    message.sender || null,

                content:
                    message.content || "",

                client_id:
                    message.client_id
                        ? String(message.client_id)
                        : null,

                is_read:
                    message.is_read ?? false,

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

        } catch (error) {

            console.warn(
                "saveMessageToDB xətası:",
                error
            );

        }

    }


    // =========================================================
    // SAVE PENDING MESSAGE
    // =========================================================

    function savePendingMessageToDB(message) {

        if (
            !message ||
            !message.client_id
        ) {

            return Promise.resolve(false);

        }


        return dbReadyPromise
            .then(function () {

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


                return new Promise(
                    function (resolve) {

                        try {

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


                        } catch (error) {

                            console.error(
                                "Pending mesaj IndexedDB xətası:",
                                error
                            );


                            resolve(false);

                        }

                    }
                );

            })
            .catch(function (error) {

                console.warn(
                    "Pending DB hazır deyil:",
                    error
                );


                return false;

            });

    }


    // =========================================================
    // DELETE PENDING MESSAGE
    // =========================================================

    function deletePendingMessageFromDB(clientId) {

        if (
            !db ||
            !clientId
        ) {
            return Promise.resolve(false);
        }


        return new Promise(
            function (resolve) {

                try {

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
                        store.delete(
                            String(clientId)
                        );


                    request.onsuccess =
                        function () {

                            resolve(true);

                        };


                    request.onerror =
                        function () {

                            console.warn(
                                "Pending mesaj silinmədi:",
                                request.error
                            );


                            resolve(false);

                        };

                } catch (error) {

                    console.warn(
                        "Pending mesaj silinərkən xəta:",
                        error
                    );


                    resolve(false);

                }

            }
        );

    }


    // =========================================================
    // SAVE CONVERSATION TO INDEXEDDB
    // =========================================================

    function saveConversationToDB(otherUser) {

        if (
            !db ||
            !otherUser
        ) {
            return;
        }


        try {

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

        } catch (error) {

            console.warn(
                "saveConversationToDB xətası:",
                error
            );

        }

    }


    // =========================================================
    // LOAD INITIAL CACHE
    // =========================================================

    function loadInitialCache() {

        if (
            !db ||
            initialCacheLoaded
        ) {
            return;
        }


        initialCacheLoaded = true;


        try {

            const transaction =
                db.transaction(
                    [
                        CONVERSATION_STORE,
                        MESSAGE_STORE,
                        PENDING_MESSAGE_STORE
                    ],
                    "readonly"
                );


            const conversationStore =
                transaction.objectStore(
                    CONVERSATION_STORE
                );


            const messageStore =
                transaction.objectStore(
                    MESSAGE_STORE
                );


            const pendingStore =
                transaction.objectStore(
                    PENDING_MESSAGE_STORE
                );


            const conversationRequest =
                conversationStore.get(
                    String(conversationId)
                );


            const messagesRequest =
                messageStore
                    .index("conversationId")
                    .getAll(
                        String(conversationId)
                    );


            const pendingRequest =
                pendingStore
                    .index("conversationId")
                    .getAll(
                        String(conversationId)
                    );


            transaction.oncomplete =
                function () {

                    const cachedConversation =
                        conversationRequest.result;


                    const cachedMessages =
                        messagesRequest.result || [];


                    const pendingMessages =
                        pendingRequest.result || [];


                    /*
                     * ------------------------------------------------
                     * CONVERSATION
                     * ------------------------------------------------
                     */

                    if (
                        cachedConversation &&
                        cachedConversation.user
                    ) {

                        renderChatUser(
                            cachedConversation.user
                        );

                    }


                    /*
                     * ------------------------------------------------
                     * REAL SERVER MESSAGES
                     * ------------------------------------------------
                     */

                    const validMessages =
                        cachedMessages
                            .filter(function (message) {

                                return (
                                    isRealServerMessage(
                                        message
                                    ) &&
                                    !message.optimistic
                                );

                            })
                            .sort(function (a, b) {

                                /*
                                 * Server ID authoritative.
                                 */
                                return (
                                    Number(a.id) -
                                    Number(b.id)
                                );

                            })
                            .slice(-20);


                    validMessages.forEach(
                        function (message) {

                            insertServerMessageInOrder(
                                message,
                                false
                            );

                        }
                    );


                    if (
                        validMessages.length
                    ) {

                        oldestMessageId =
                            validMessages[0].id;

                    }


                    /*
                     * ------------------------------------------------
                     * CONFIRMED CLIENT IDS
                     * ------------------------------------------------
                     */

                    const confirmedClientIds =
                        new Set();


                    cachedMessages.forEach(
                        function (message) {

                            if (
                                message &&
                                message.client_id
                            ) {

                                confirmedClientIds.add(
                                    String(
                                        message.client_id
                                    )
                                );

                            }

                        }
                    );


                    /*
                     * ------------------------------------------------
                     * PENDING MESSAGES
                     * ------------------------------------------------
                     */

                    pendingMessages
                        .filter(function (message) {

                            return (
                                message &&
                                message.client_id
                            );

                        })
                        .sort(function (a, b) {

                            const timeDifference =
                                getMessageTimestamp(a) -
                                getMessageTimestamp(b);


                            if (
                                timeDifference !== 0
                            ) {

                                return timeDifference;

                            }


                            return String(
                                a.client_id
                            ).localeCompare(
                                String(b.client_id)
                            );

                        })
                        .forEach(function (message) {

                            const clientId =
                                String(
                                    message.client_id
                                );


                            /*
                             * Server artıq təsdiqləyibsə,
                             * pending lazım deyil.
                             */
                            if (
                                confirmedClientIds.has(
                                    clientId
                                )
                            ) {

                                deletePendingMessageFromDB(
                                    clientId
                                );

                                return;

                            }


                            /*
                             * DOM-da artıq varsa yaratma.
                             */
                            if (
                                findOptimisticByClientId(
                                    clientId
                                )
                            ) {

                                return;

                            }


                            renderOptimisticMessage(
                                message
                            );

                        });


                    /*
                     * Cache hazırdır.
                     */
                    isInitialLoading = false;


                    /*
                     * Chat aşağıda açılır.
                     */
                    requestAnimationFrame(
                        function () {

                            if (
                                validMessages.length ||
                                pendingMessages.length
                            ) {

                                scrollToBottom();

                            }

                        }
                    );


                    /*
                     * İndi API + WebSocket başlayır.
                     */
                    initializeChat();

                };


            transaction.onerror =
                function (event) {

                    console.warn(
                        "IndexedDB initial cache xətası:",
                        event.target.error
                    );


                    isInitialLoading = false;


                    initializeChat();

                };

        } catch (error) {

            console.warn(
                "loadInitialCache xətası:",
                error
            );


            isInitialLoading = false;


            initializeChat();

        }

    }


    // =========================================================
    // INITIALIZE CHAT
    // =========================================================

    function initializeChat() {

        if (chatInitialized) {
            return;
        }


        chatInitialized = true;


        /*
         * Cache artıq göstərilib.
         *
         * Bundan sonra API və WebSocket işləyir.
         */
        loadConversation();

        loadMessages();

        connectWebSocket();

    }


    // =========================================================
    // RENDER CHAT USER
    // =========================================================

    function renderChatUser(otherUser) {

        if (!otherUser) {
            return;
        }


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

        const $onlineDot =
            $("#chatUserOnlineDot");

        if (otherUser.is_online === true) {

            $status
                .text("Onlayn")
                .removeClass("offline")
                .addClass("online");

            $onlineDot
                .removeClass("offline-dot")
                .addClass("online-dot");

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

            $onlineDot
                .removeClass("online-dot")
                .addClass("offline-dot");

            return;
        }

        $status
            .text("Son giriş məlum deyil")
            .removeClass("online")
            .addClass("offline");

        $onlineDot
            .removeClass("online-dot")
            .addClass("offline-dot");

    }


    // =========================================================
    // LOAD CONVERSATION API
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
    // LOAD MESSAGES API
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
                                        Number(a.id) -
                                        Number(b.id)
                                    );

                                }
                            )
                            .slice(-20);


                    let changed = false;


                    serverMessages.forEach(
                        function (message) {

                            /*
                             * Əvvəl reconciliation.
                             *
                             * Əgər optimistic DOM varsa,
                             * onu yerindən tərpətmədən
                             * real mesaja çeviririk.
                             */
                            if (
                                reconcileOptimisticMessage(
                                    message
                                )
                            ) {

                                changed = true;

                                return;

                            }


                            /*
                             * Normal server message.
                             */
                            if (
                                insertServerMessageInOrder(
                                    message,
                                    true
                                )
                            ) {

                                changed = true;

                            }

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
                     * İlk API load zamanı aşağıda qal.
                     */
                    if (!changed) {

                        requestAnimationFrame(
                            function () {

                                scrollToBottom();

                            }
                        );

                    }

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
            $(
                `
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
                `
            );


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
    // FIND OPTIMISTIC BY CLIENT ID
    // =========================================================

    function findOptimisticByClientId(clientId) {

        if (!clientId) {
            return null;
        }


        const target =
            String(clientId);


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


            const itemClientId =
                $item.attr(
                    "data-client-id"
                );


            if (
                String(itemClientId || "") ===
                target
            ) {

                return $item;

            }

        }


        return null;

    }


    // =========================================================
    // INSERT SERVER MESSAGE IN ORDER
    // =========================================================

    function insertServerMessageInOrder(
        message,
        saveToDB = true
    ) {

        if (
            !isRealServerMessage(message)
        ) {
            return false;
        }


        const messageId =
            String(message.id);


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


        const messageNumericId =
            Number(message.id);


        const $message =
            createMessageElement(
                message
            );


        let inserted = false;


        const $rows =
            $messagesArea.find(
                ".message-row"
            );


        /*
         * Server ID əsas authoritative order-dir.
         *
         * Optimistic row-lara toxunmuruq.
         *
         * Əgər qarşıdakı row real server mesajıdır
         * və onun ID-si böyükdürsə, bundan əvvəl salırıq.
         */
        $rows.each(
            function () {

                if (inserted) {
                    return;
                }


                const $row =
                    $(this);


                const rowMessageId =
                    $row.attr(
                        "data-message-id"
                    );


                /*
                 * Optimistic mesajdırsa:
                 *
                 * onun yerini dəyişmirik.
                 *
                 * Sadəcə davam edirik.
                 */
                if (
                    $row.hasClass(
                        "optimistic-message"
                    )
                ) {

                    return;

                }


                const rowNumericId =
                    Number(
                        rowMessageId
                    );


                if (
                    Number.isFinite(
                        rowNumericId
                    ) &&
                    rowNumericId >
                    messageNumericId
                ) {

                    $message.insertBefore(
                        $row
                    );


                    inserted = true;

                }

            }
        );


        if (!inserted) {

            /*
             * Yeni real server mesajı ən sona.
             *
             * Optimistic mesajlar varsa belə,
             * onların DOM yeri dəyişdirilmir.
             */
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


        /*
         * ÇOX VACİB:
         *
         * Artıq content fallback YOXDUR.
         *
         * Yalnız client_id ilə match edirik.
         *
         * Beləliklə:
         *
         * 1
         * 2
         * 3
         * 1
         * 4
         * 5
         *
         * kimi eyni content-lər qarışmır.
         */
        const clientId =
            serverMessage.client_id
                ? String(
                    serverMessage.client_id
                )
                : null;


        /*
         * Backend client_id qaytarmırsa,
         * optimistic mesajı təxmin etməyə çalışma.
         */
        if (!clientId) {

            return false;

        }


        const serverMessageId =
            String(
                serverMessage.id
            );


        const $optimistic =
            findOptimisticByClientId(
                clientId
            );


        /*
         * -----------------------------------------------------
         * SERVER MESSAGE ALREADY RENDERED
         * -----------------------------------------------------
         */

        if (
            renderedMessageIds.has(
                serverMessageId
            )
        ) {

            if (
                $optimistic &&
                $optimistic.length
            ) {

                $optimistic.remove();

            }


            deletePendingMessageFromDB(
                clientId
            );


            return true;

        }


        /*
         * -----------------------------------------------------
         * OPTIMISTIC DOM YOXDUR
         * -----------------------------------------------------
         *
         * Reload / API race zamanı mümkündür.
         *
         * Bu halda real mesajı normal render edirik.
         */

        if (
            !$optimistic ||
            !$optimistic.length
        ) {

            deletePendingMessageFromDB(
                clientId
            );


            return insertServerMessageInOrder(
                serverMessage,
                true
            );

        }


        /*
         * -----------------------------------------------------
         * OPTIMISTIC → REAL
         * -----------------------------------------------------
         *
         * ƏSAS QAYDA:
         *
         * DOM elementinin yeri DƏYİŞMİR.
         *
         * Sadəcə həmin elementin məlumatları dəyişir.
         */

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
                clientId
            )
            .attr(
                "data-created-at",
                serverMessage.created_at || ""
            );


        /*
         * Content.
         */

        $optimistic
            .find("p")
            .text(
                serverMessage.content || ""
            );


        /*
         * Time.
         */

        $optimistic
            .find("time")
            .text(
                formatMessageTime(
                    serverMessage.created_at
                )
            );


        /*
         * Sent / received.
         */

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


        /*
         * Check icon.
         */

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


        /*
         * Memory state.
         */

        renderedMessageIds.add(
            serverMessageId
        );


        liveMessages.set(
            serverMessageId,
            serverMessage
        );


        /*
         * Real mesajı DB-yə yaz.
         */

        saveMessageToDB(
            serverMessage
        );


        /*
         * Pending artıq lazım deyil.
         */

        deletePendingMessageFromDB(
            clientId
        );


        return true;

    }


    // =========================================================
    // RENDER OPTIMISTIC MESSAGE
    // =========================================================

    function renderOptimisticMessage(message) {

        if (
            !message ||
            !message.client_id
        ) {
            return;
        }


        /*
         * Duplicate optimistic message yaratma.
         */
        if (
            findOptimisticByClientId(
                message.client_id
            )
        ) {

            return;

        }


        const $message =
            createMessageElement({
                ...message,
                optimistic: true
            });


        /*
         * Optimistic mesaj həmişə
         * öz local send sırasına görə sona əlavə olunur.
         */
        $messagesArea.append(
            $message
        );

    }


    // =========================================================
    // RENDER MESSAGE
    // =========================================================

    function renderMessage(message) {

        if (!message) {
            return;
        }


        if (message.optimistic) {

            renderOptimisticMessage(
                message
            );

            return;

        }


        insertServerMessageInOrder(
            message,
            true
        );

    }


    // =========================================================
    // ESCAPE ATTRIBUTE
    // =========================================================

    function escapeHtmlAttribute(value) {

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

    function formatMessageTime(dateString) {

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

    function formatLastSeen(dateString) {

        const date = new Date(dateString);

        if (
            isNaN(
                date.getTime()
            )
        ) {
            return "—";
        }

        const now = new Date();

        const sameDay =
            date.getFullYear() === now.getFullYear() &&
            date.getMonth() === now.getMonth() &&
            date.getDate() === now.getDate();

        if (sameDay) {

            return `Bugün, ${String(
                date.getHours()
            ).padStart(2, "0")}:${String(
                date.getMinutes()
            ).padStart(2, "0")}`;

        }

        const day =
            String(
                date.getDate()
            ).padStart(2, "0");

        const month =
            String(
                date.getMonth() + 1
            ).padStart(2, "0");

        const year =
            date.getFullYear();

        const hour =
            String(
                date.getHours()
            ).padStart(2, "0");

        const minute =
            String(
                date.getMinutes()
            ).padStart(2, "0");

        return `${day}.${month}.${year}, ${hour}:${minute}`;
    }


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


        /*
         * Hər mesaj üçün unikal client_id.
         */
        const clientId =
            generateClientId();


        /*
         * Input təmizlənir.
         */
        $messageInput.val("");


        $messageInput.css(
            "height",
            "auto"
        );


        /*
         * Optimistic message.
         */
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


        /*
         * 1. Əvvəl UI.
         */
        renderOptimisticMessage(
            optimisticMessage
        );


        /*
         * 2. Scroll.
         */
        scrollToBottom();


        /*
         * 3. ƏVVƏL DB.
         *
         * Reload indi olsa belə mesaj itməyəcək.
         */
        const saved =
            await savePendingMessageToDB(
                optimisticMessage
            );


        if (!saved) {

            console.warn(
                "Pending mesaj DB-yə yazılmadı:",
                clientId
            );

        }


        /*
         * 4. Socket hazırdırsa queue-ni işə sal.
         *
         * Artıq BURADA socket.send() YOXDUR.
         */
        requestOutgoingQueue();

    }


    // =========================================================
    // REQUEST OUTGOING QUEUE
    // =========================================================

    function requestOutgoingQueue() {

        outgoingQueueRequested = true;


        processOutgoingQueue();

    }


    // =========================================================
    // WAIT FOR SOCKET OPEN
    // =========================================================

    function waitForSocketOpen() {

        if (
            socket &&
            socket.readyState ===
            WebSocket.OPEN
        ) {

            return Promise.resolve(true);

        }


        connectWebSocket();


        return new Promise(
            function (resolve) {

                const check =
                    function () {

                        if (
                            socket &&
                            socket.readyState ===
                            WebSocket.OPEN
                        ) {

                            resolve(true);

                            return;

                        }


                        if (
                            !socket ||
                            socket.readyState ===
                            WebSocket.CLOSED
                        ) {

                            /*
                             * Reconnect artıq schedule olunacaq.
                             *
                             * Burada sonsuz interval saxlamırıq.
                             */
                            resolve(false);

                            return;

                        }


                        setTimeout(
                            check,
                            100
                        );

                    };


                check();

            }
        );

    }


    // =========================================================
    // GET PENDING MESSAGES
    // =========================================================

    function getPendingMessages() {

        return dbReadyPromise
            .then(function () {

                if (!db) {
                    return [];
                }


                return new Promise(
                    function (resolve) {

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
                                    String(
                                        conversationId
                                    )
                                );


                            request.onsuccess =
                                function () {

                                    const messages =
                                        request.result || [];


                                    messages.sort(
                                        function (a, b) {

                                            const timeDifference =
                                                getMessageTimestamp(a) -
                                                getMessageTimestamp(b);


                                            if (
                                                timeDifference !== 0
                                            ) {

                                                return timeDifference;

                                            }


                                            return String(
                                                a.client_id
                                            ).localeCompare(
                                                String(
                                                    b.client_id
                                                )
                                            );

                                        }
                                    );


                                    resolve(
                                        messages
                                    );

                                };


                            request.onerror =
                                function () {

                                    console.warn(
                                        "Pending mesajlar oxunmadı:",
                                        request.error
                                    );


                                    resolve([]);

                                };

                        } catch (error) {

                            console.warn(
                                "getPendingMessages xətası:",
                                error
                            );


                            resolve([]);

                        }

                    }
                );

            })
            .catch(function () {

                return [];

            });

    }


    // =========================================================
    // SEND ONE PENDING MESSAGE
    // =========================================================

    function sendPendingMessage(item) {

        return new Promise(
            async function (resolve, reject) {

                if (
                    !item ||
                    !item.client_id ||
                    !item.content
                ) {

                    resolve(false);

                    return;

                }


                const clientId =
                    String(
                        item.client_id
                    );


                /*
                 * Socket hazır deyilsə.
                 */
                const socketReady =
                    await waitForSocketOpen();


                if (!socketReady) {

                    reject(
                        new Error(
                            "WebSocket hazır deyil."
                        )
                    );

                    return;

                }


                /*
                 * Socket artıq başqa ACK gözləyirsə,
                 * bu funksiya çağırılmamalıdır.
                 */
                if (
                    waitingForAckClientId
                ) {

                    reject(
                        new Error(
                            "Başqa mesaj ACK gözləyir."
                        )
                    );

                    return;

                }


                waitingForAckClientId =
                    clientId;


                let timeoutId = null;


                waitingForAckResolve =
                    function () {

                        if (timeoutId) {

                            clearTimeout(
                                timeoutId
                            );

                        }


                        timeoutId = null;


                        waitingForAckClientId =
                            null;

                        waitingForAckResolve =
                            null;

                        waitingForAckReject =
                            null;


                        resolve(true);

                    };


                waitingForAckReject =
                    function (error) {

                        if (timeoutId) {

                            clearTimeout(
                                timeoutId
                            );

                        }


                        timeoutId = null;


                        waitingForAckClientId =
                            null;

                        waitingForAckResolve =
                            null;

                        waitingForAckReject =
                            null;


                        reject(error);

                    };


                /*
                 * ACK timeout.
                 */
                timeoutId =
                    setTimeout(
                        function () {

                            if (
                                waitingForAckReject
                            ) {

                                waitingForAckReject(
                                    new Error(
                                        "ACK timeout"
                                    )
                                );

                            }

                        },
                        ACK_TIMEOUT
                    );


                try {

                    socket.send(
                        JSON.stringify({

                            message:
                                String(
                                    item.content
                                ),

                            client_id:
                                clientId

                        })
                    );

                } catch (error) {

                    if (
                        waitingForAckReject
                    ) {

                        waitingForAckReject(
                            error
                        );

                    }

                }

            }
        );

    }


    // =========================================================
    // PROCESS OUTGOING QUEUE
    // =========================================================

    async function processOutgoingQueue() {

        if (outgoingQueueRunning) {
            return;
        }


        if (!outgoingQueueRequested) {
            return;
        }


        outgoingQueueRunning = true;

        outgoingQueueRequested = false;


        try {

            while (true) {

                /*
                 * Pending mesajları DB-dən yenidən oxuyuruq.
                 *
                 * Bu çox vacibdir:
                 *
                 * 1
                 * 2
                 * 3
                 * 4
                 * 5
                 *
                 * hamısı artıq DB-dədirsə,
                 * sıra qorunur.
                 */

                const pendingMessages =
                    await getPendingMessages();


                if (
                    !pendingMessages.length
                ) {

                    break;

                }


                const item =
                    pendingMessages[0];


                if (
                    !item ||
                    !item.client_id
                ) {

                    if (item && item.client_id) {

                        await deletePendingMessageFromDB(
                            item.client_id
                        );

                    }

                    continue;

                }


                /*
                 * Socket yoxdursa reconnect.
                 */
                if (
                    !socket ||
                    socket.readyState !==
                    WebSocket.OPEN
                ) {

                    connectWebSocket();

                    /*
                     * Bu anda queue dayansın.
                     *
                     * Socket onopen yenidən
                     * requestOutgoingQueue() çağıracaq.
                     */
                    break;

                }


                try {

                    /*
                     * YALNIZ BİR mesaj göndərilir.
                     *
                     * ACK gələnə qədər ikinci mesaj
                     * göndərilmir.
                     */
                    await sendPendingMessage(
                        item
                    );


                    /*
                     * ACK gəlibsə pending record artıq
                     * reconcile zamanı silinib.
                     *
                     * Amma təhlükəsizlik üçün:
                     */
                    await deletePendingMessageFromDB(
                        item.client_id
                    );


                } catch (error) {

                    console.warn(
                        "Pending mesaj göndərilməsi dayandı:",
                        error
                    );


                    /*
                     * Socket bağlanıbsa:
                     * reconnect olacaq.
                     *
                     * client_id DB-də qalır.
                     *
                     * Buna görə mesaj itməyəcək.
                     */
                    break;

                }

            }

        } finally {

            outgoingQueueRunning = false;


            /*
             * Queue işləyərkən yeni mesaj gəlibsə,
             * yenidən yoxla.
             */
            if (
                outgoingQueueRequested
            ) {

                processOutgoingQueue();

            }

        }

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
                        !Array.isArray(messages) ||
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
                                        Number(a.id) -
                                        Number(b.id)
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


                    /*
                     * Ən köhnədən ən yeniyə prepend.
                     */
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

        /*
         * Artıq açıq socket.
         */
        if (
            socket &&
            socket.readyState ===
            WebSocket.OPEN
        ) {

            requestOutgoingQueue();

            return Promise.resolve(true);

        }


        /*
         * Hazırda CONNECTING.
         */
        if (
            socket &&
            socket.readyState ===
            WebSocket.CONNECTING
        ) {

            return socketConnectionPromise ||
                Promise.resolve(false);

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

            return Promise.resolve(false);

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


        const generation =
            ++socketGeneration;


        const newSocket =
            new WebSocket(
                wsUrl
            );


        socket =
            newSocket;


        /*
         * Connection Promise.
         */
        socketConnectionPromise =
            new Promise(
                function (resolve) {

                    let settled = false;


                    function finish(value) {

                        if (settled) {
                            return;
                        }


                        settled = true;

                        resolve(value);

                    }


                    // -------------------------------------------------
                    // OPEN
                    // -------------------------------------------------

                    newSocket.onopen =
                        function () {

                            if (
                                socket !==
                                newSocket ||
                                generation !==
                                socketGeneration
                            ) {

                                return;

                            }


                            finish(true);


                            socketConnectionPromise =
                                null;


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


                            /*
                             * Socket açılan kimi
                             * bütün pending-ləri
                             * nəzarətli queue ilə göndər.
                             */
                            requestOutgoingQueue();

                        };


                    // -------------------------------------------------
                    // MESSAGE
                    // -------------------------------------------------

                    newSocket.onmessage =
                        function (event) {

                            if (
                                socket !==
                                newSocket
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


                            /*
                             * ACK / optimistic reconciliation.
                             */
                            const reconciled =
                                reconcileOptimisticMessage(
                                    message
                                );


                            /*
                             * Əgər bu bizim hazırda
                             * göndərdiyimiz mesajdırsa,
                             * ACK gözləyən Promise-i tamamla.
                             */
                            const receivedClientId =
                                message.client_id
                                    ? String(
                                        message.client_id
                                    )
                                    : null;


                            if (
                                receivedClientId &&
                                waitingForAckClientId &&
                                receivedClientId ===
                                waitingForAckClientId
                            ) {

                                if (
                                    waitingForAckResolve
                                ) {

                                    waitingForAckResolve();

                                }

                            }


                            if (reconciled) {

                                return;

                            }


                            /*
                             * Başqa istifadəçinin mesajı.
                             */
                            const shouldScroll =
                                isNearBottom();


                            const inserted =
                                insertServerMessageInOrder(
                                    message,
                                    true
                                );


                            if (
                                inserted &&
                                shouldScroll
                            ) {

                                scrollToBottom();

                            }

                        };


                    // -------------------------------------------------
                    // CLOSE
                    // -------------------------------------------------

                    newSocket.onclose =
                        function () {

                            finish(false);


                            if (
                                socket !==
                                newSocket
                            ) {

                                return;

                            }


                            socket = null;


                            socketConnectionPromise =
                                null;


                            /*
                             * Hazırda ACK gözləyirdiksə,
                             * onu reject edirik.
                             *
                             * Pending DB-də qalır.
                             */
                            if (
                                waitingForAckReject
                            ) {

                                waitingForAckReject(
                                    new Error(
                                        "WebSocket bağlandı."
                                    )
                                );

                            }


                            if (presenceTimer) {

                                clearInterval(
                                    presenceTimer
                                );


                                presenceTimer =
                                    null;

                            }


                            scheduleReconnect();

                        };


                    // -------------------------------------------------
                    // ERROR
                    // -------------------------------------------------

                    newSocket.onerror =
                        function (error) {

                            if (
                                socket !==
                                newSocket
                            ) {

                                return;

                            }


                            console.warn(
                                "WebSocket xətası:",
                                error
                            );

                        };

                }
            );


        return socketConnectionPromise;

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

                    reconnectTimer =
                        null;


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

    /*
     * Köhnə flushPendingMessages() saxlanılır,
     * amma artıq ayrıca socket.send() edən sistem deyil.
     *
     * Bu funksiyanı başqa hissələr də çağırsa,
     * təhlükəsiz şəkildə queue-ni işə salır.
     */
    function flushPendingMessages() {

        requestOutgoingQueue();

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
                        !Array.isArray(messages)
                    ) {
                        return;
                    }


                    const shouldScroll =
                        isNearBottom();


                    let added = false;


                    messages
                        .filter(
                            isRealServerMessage
                        )
                        .sort(
                            function (a, b) {

                                return (
                                    Number(a.id) -
                                    Number(b.id)
                                );

                            }
                        )
                        .forEach(
                            function (message) {

                                /*
                                 * Əvvəl optimistic
                                 * reconciliation.
                                 */
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
                                        true
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


                    /*
                     * Pending queue də yoxlanılır.
                     */
                    requestOutgoingQueue();

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


            /*
             * Socket yoxdursa reconnect.
             */
            if (
                !socket ||
                socket.readyState !==
                WebSocket.OPEN
            ) {

                connectWebSocket();

            } else {

                sendPresence();

            }


            /*
             * User məlumatını yenilə.
             */
            loadConversation();


            /*
             * Serverdə bu müddətdə gələn
             * mesajları yoxla.
             */
            checkNewMessages();


            /*
             * Pending queue.
             */
            requestOutgoingQueue();

        }
    );


    // =========================================================
    // BEFORE UNLOAD
    // =========================================================

    window.addEventListener(
        "beforeunload",
        function () {

            if (presenceTimer) {

                clearInterval(
                    presenceTimer
                );

                presenceTimer = null;

            }


            if (reconnectTimer) {

                clearTimeout(
                    reconnectTimer
                );

                reconnectTimer = null;

            }


            /*
             * ACK gözləyən Promise-i
             * səhifə bağlanarkən reject et.
             *
             * Pending DB-də qaldığı üçün
             * reload sonrası yenidən göndərilə bilər.
             */
            if (
                waitingForAckReject
            ) {

                waitingForAckReject(
                    new Error(
                        "Səhifə bağlanır."
                    )
                );

            }


            if (socket) {

                try {

                    socket.close();

                } catch (error) {

                    // ignore

                }

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
    // MUTE
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


    // =========================================================
    // CLEAR
    // =========================================================

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


    // =========================================================
    // BLOCK
    // =========================================================

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

    /*
     * BURADA artıq:
     *
     * loadConversation();
     * loadMessages();
     * connectWebSocket();
     *
     * birbaşa çağırılmır.
     *
     * Əvvəl IndexedDB cache hazırlanır,
     * sonra initializeChat() çağırılır.
     *
     * DB error olsa belə dbRequest.onerror
     * initializeChat() çağırır.
     */

});