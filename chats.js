$(document).ready(function () {


    // =========================
    // LOAD EMPLOYEES
    // =========================

    function loadEmployees() {

        const cachedEmployees =
            JSON.parse(
                localStorage.getItem("dmsEmployees")
            ) || null;


        // =========================
        // SHOW CACHE FIRST
        // =========================

        if (cachedEmployees) {

            renderEmployees(
                cachedEmployees
            );

        }


        // =========================
        // GET FRESH DATA
        // =========================

        apiRequest({

            url: API_URL + "/api/employees/",
            type: "GET",

            success: function (employees) {

                // Cache yenilə
                localStorage.setItem(
                    "dmsEmployees",
                    JSON.stringify(employees)
                );

                // Təzə məlumatı göstər
                renderEmployees(
                    employees
                );

            },

            error: function (xhr) {

                console.log(
                    "Əməkdaşlar yüklənmədi:",
                    xhr.responseText
                );

            }

        });

    }


    // =========================
    // RENDER EMPLOYEES
    // =========================

    function renderEmployees(employees) {

        $("#contactsList").empty();


        const currentUser =
            JSON.parse(
                localStorage.getItem(
                    "currentUser"
                )
            ) || null;

        employees.sort(function (a, b) {

            const currentUser = JSON.parse(
                localStorage.getItem("currentUser")
            );

            const aIsMe = currentUser &&
                String(a.id) === String(currentUser.id);

            const bIsMe = currentUser &&
                String(b.id) === String(currentUser.id);

            if (aIsMe) return -1;
            if (bIsMe) return 1;

            const nameA =
                `${a.first_name || ""} ${a.last_name || ""}`.trim();

            const nameB =
                `${b.first_name || ""} ${b.last_name || ""}`.trim();

            return nameA.localeCompare(nameB, "az");
        });


        employees.forEach(function (employee) {

            const fullName =
                `${employee.first_name || ""} ${employee.last_name || ""}`
                    .trim();


            const isCurrentUser =
                currentUser &&
                String(employee.id) ===
                String(currentUser.id);


            const name =
                isCurrentUser
                    ? "Mən"
                    : (
                        fullName ||
                        employee.username
                    );


            const contact =
                $("<div>")
                    .addClass("contact-item")
                    .attr(
                        "data-user-id",
                        employee.id
                    );


            const avatar =
                $("<div>")
                    .addClass("contact-avatar")
                    .text(
                        name
                            .charAt(0)
                            .toUpperCase()
                    );


            const info =
                $("<div>")
                    .addClass("contact-info");


            const top =
                $("<div>")
                    .addClass("contact-top");


            const contactName =
                $("<h3>")
                    .addClass("contact-name")
                    .text(name);


            const position =
                $("<p>")
                    .addClass("contact-position")
                    .text(
                        employee.position ||
                        "DMS istifadəçisi"
                    );


            top.append(contactName);

            info.append(top);
            info.append(position);

            contact.append(avatar);
            contact.append(info);

            $("#contactsList")
                .append(contact);

        });

    }


    // =========================
    // LOAD CONVERSATIONS
    // =========================

    function loadConversations() {

        const cachedConversations =
            JSON.parse(
                localStorage.getItem("dmsConversations")
            ) || null;


        // =========================
        // SHOW CACHE FIRST
        // =========================

        if (cachedConversations) {

            renderConversations(
                cachedConversations
            );

        }


        // =========================
        // GET FRESH DATA
        // =========================

        apiRequest({

            url: API_URL + "/api/conversations/",
            type: "GET",

            success: function (conversations) {

                // Cache yenilə
                localStorage.setItem(
                    "dmsConversations",
                    JSON.stringify(conversations)
                );

                // Yeni məlumatı göstər
                renderConversations(
                    conversations
                );

            },

            error: function (xhr) {

                console.log(
                    "Söhbətlər yüklənmədi:",
                    xhr.responseText
                );

            }

        });

    }


    // =========================
    // RENDER CONVERSATIONS
    // =========================

    function renderConversations(conversations) {

        $("#chatList").empty();

        if (!conversations || !conversations.length) {

            $("#emptyState").addClass("active");

            return;

        }

        $("#emptyState").removeClass("active");

        const currentUser =
            JSON.parse(
                localStorage.getItem("currentUser")
            ) || null;


        conversations.forEach(function (conversation) {

            const participants =
                conversation.participants || [];


            // =========================
            // OTHER USER
            // =========================

            const otherParticipants = currentUser
                ? participants.filter(function (user) {

                    return String(user.id) !==
                        String(currentUser.id);

                })
                : participants;


            // =========================
            // SELF CHAT
            // =========================

            const isSelfChat =
                currentUser &&
                participants.length > 0 &&
                participants.every(function (user) {

                    return String(user.id) ===
                        String(currentUser.id);

                });


            // =========================
            // CHAT NAME
            // =========================

            const names =
                otherParticipants.map(function (user) {

                    const fullName =
                        `${user.first_name || ""} ${user.last_name || ""}`
                            .trim();

                    return fullName || user.username || "";

                }).filter(Boolean);


            const chatName =
                isSelfChat
                    ? "Mən"
                    : names.join(", ") || "Naməlum söhbət";


            // =========================
            // AVATAR
            // =========================

            const firstName =
                isSelfChat
                    ? ""
                    : (otherParticipants[0]?.first_name || "");

            const lastName =
                isSelfChat
                    ? ""
                    : (otherParticipants[0]?.last_name || "");


            const avatarText =
                (
                    firstName.charAt(0) +
                    lastName.charAt(0)
                ).toUpperCase() ||
                chatName.charAt(0).toUpperCase();


            // =========================
            // CHAT ITEM
            // =========================

            const chatItem =
                $("<article>")
                    .addClass("chat-item")
                    .attr(
                        "data-conversation-id",
                        conversation.id
                    );


            const avatar =
                $("<div>")
                    .addClass("chat-avatar")
                    .text(avatarText);


            const onlineDot =
                $("<span>")
                    .addClass("online-dot offline-dot");


            const content =
                $("<div>")
                    .addClass("chat-content");


            const top =
                $("<div>")
                    .addClass("chat-top");


            const title =
                $("<h3>")
                    .text(chatName);


            const time =
                $("<time>")
                    .text(
                        formatConversationTime(
                            conversation.updated_at
                        )
                    );


            const bottom =
                $("<div>")
                    .addClass("chat-bottom");


            const lastMessage =
                $("<p>")
                    .text("Söhbət başladı");


            // =========================
            // ONLINE STATUS
            // =========================

            const otherUser =
                otherParticipants[0];

            const isOnline =
                otherUser?.is_online === true;


            onlineDot
                .removeClass("online-dot offline-dot")
                .addClass(
                    isOnline
                        ? "online-dot"
                        : "offline-dot"
                );


            // Özünlə söhbətdə online nöqtəsini göstərmə.
            if (isSelfChat) {

                onlineDot.hide();

            }


            // =========================
            // BUILD CHAT ITEM
            // =========================

            top.append(title);
            top.append(time);

            bottom.append(lastMessage);

            content.append(top);
            content.append(bottom);

            chatItem.append(avatar);

            avatar.append(onlineDot);

            chatItem.append(content);

            $("#chatList").append(chatItem);

        });

    }



    // =========================
    // CONVERSATION TIME
    // =========================

    function formatConversationTime(dateString) {

        if (!dateString) {
            return "";
        }

        const date =
            new Date(dateString);

        if (isNaN(date.getTime())) {
            return "";
        }

        const now =
            new Date();

        const sameDay =
            date.toDateString() ===
            now.toDateString();

        const yesterday = new Date(now);

        yesterday.setDate(now.getDate() - 1);

        const isYesterday =
            date.toDateString() === yesterday.toDateString();

        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();



        if (sameDay) {

            return date.toLocaleTimeString(
                "az-AZ",
                {
                    hour: "2-digit",
                    minute: "2-digit"
                }
            );

        }

        if (isYesterday) {

            return "Dünən";

        }

        return `${day}.${month}.${year}`;

    }


    // =========================
    // PAGE NAVIGATION
    // =========================

    function showPage(page) {

        localStorage.setItem(
            "dmsCurrentPage",
            page
        );

        $(".page-section")
            .removeClass("active");

        $(".nav-item")
            .removeClass("active");


        // SEARCH RESET

        $("#searchBox")
            .removeClass("active");

        $("#chatSearch")
            .val("");

        $(".chat-item")
            .show();

        $(".contact-item")
            .show();

        $("#emptyState")
            .removeClass("active");


        // =========================
        // CHATS
        // =========================

        if (page === "chats") {

            $("#chatsPage")
                .addClass("active");

            $('.nav-item[data-page="chats"]')
                .addClass("active");

            $("#searchButton")
                .show();

            loadConversations();

        }


        // =========================
        // CONTACTS
        // =========================

        else if (page === "contacts") {

            $("#contactsPage")
                .addClass("active");

            $('.nav-item[data-page="contacts"]')
                .addClass("active");

            $("#searchButton")
                .show();

            loadEmployees();

        }


        // =========================
        // PROFILE
        // =========================

        else if (page === "profile") {

            $("#profilePage")
                .addClass("active");

            $('.nav-item[data-page="profile"]')
                .addClass("active");

            $("#searchButton")
                .hide();

            loadProfile();

        }


        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    }


    // =========================
    // BOTTOM NAV
    // =========================

    $(".nav-item").on(
        "click",
        function () {

            const page =
                $(this).data("page");

            showPage(page);

        }
    );


    // =========================
    // SEARCH BUTTON
    // =========================

    $("#searchButton").on(
        "click",
        function () {

            if (
                $("#profilePage")
                    .hasClass("active")
            ) {
                return;
            }

            $("#searchBox")
                .addClass("active");

            $("#chatSearch")
                .trigger("focus");

        }
    );


    // =========================
    // CLOSE SEARCH
    // =========================

    $("#closeSearch").on(
        "click",
        function () {

            $("#chatSearch")
                .val("");

            $("#searchBox")
                .removeClass("active");

            $(".chat-item")
                .show();

            $(".contact-item")
                .show();

            $("#emptyState")
                .removeClass("active");

        }
    );


    // =========================
    // SEARCH INPUT
    // =========================

    $("#chatSearch").on(
        "input",
        function () {

            const value =
                $(this)
                    .val()
                    .toLowerCase()
                    .trim();


            // =========================
            // CHAT SEARCH
            // =========================

            if (
                $("#chatsPage")
                    .hasClass("active")
            ) {

                let found = false;


                $(".chat-item").each(
                    function () {

                        const name =
                            $(this)
                                .find(".chat-top h3")
                                .text()
                                .toLowerCase();


                        const message =
                            $(this)
                                .find(".chat-bottom p")
                                .text()
                                .toLowerCase();


                        if (
                            name.includes(value) ||
                            message.includes(value)
                        ) {

                            $(this).show();

                            found = true;

                        } else {

                            $(this).hide();

                        }

                    }
                );


                if (
                    value !== "" &&
                    !found
                ) {

                    $("#emptyState")
                        .addClass("active");

                } else {

                    $("#emptyState")
                        .removeClass("active");

                }

            }


            // =========================
            // CONTACT SEARCH
            // =========================

            else if (
                $("#contactsPage")
                    .hasClass("active")
            ) {

                $(".contact-item").each(
                    function () {

                        const name =
                            $(this)
                                .find(".contact-name")
                                .text()
                                .toLowerCase();


                        const position =
                            $(this)
                                .find(".contact-position")
                                .text()
                                .toLowerCase();


                        if (
                            name.includes(value) ||
                            position.includes(value)
                        ) {

                            $(this).show();

                        } else {

                            $(this).hide();

                        }

                    }
                );

            }

        }
    );


    // =========================
    // NEW CHAT
    // =========================

    $("#newChatButton").on(
        "click",
        function () {

            showPage("contacts");

        }
    );


    // =========================
    // CONTACT CLICK
    // =========================

    $(document).on("click", ".contact-item", function () {

        const userId = $(this).attr("data-user-id");

        const currentUser = JSON.parse(
            localStorage.getItem("currentUser")
        ) || null;

        if (!userId || !currentUser) {
            return;
        }

        const isSelf = String(userId) === String(currentUser.id);

        // =========================
        // OPEN CONVERSATION
        // =========================

        function openConversation(conversationId) {

            if (!conversationId) {
                console.error("Conversation ID tapılmadı.");
                return;
            }

            window.location.href =
                "chat.html?conversation=" +
                encodeURIComponent(conversationId);
        }

        // =========================
        // CREATE / GET CONVERSATION
        // =========================

        function createConversation(participantId) {

            apiRequest({

                url: API_URL + "/api/conversations/create/",
                type: "POST",
                contentType: "application/json",

                data: JSON.stringify({
                    participants: [parseInt(participantId, 10)]
                }),

                success: function (conversation) {

                    console.log("Açılan söhbət:", conversation);

                    openConversation(conversation.id);

                },

                error: function (xhr) {

                    console.error(
                        "Söhbət yaradıla bilmədi:",
                        xhr.responseText
                    );

                }

            });
        }

        // =========================
        // SELF CHAT
        // =========================

        if (isSelf) {

            apiRequest({

                url: API_URL + "/api/conversations/",
                type: "GET",

                success: function (response) {

                    const conversations = Array.isArray(response)
                        ? response
                        : (response.results || []);

                    const selfConversation = conversations.find(
                        function (conversation) {

                            const participants =
                                conversation.participants || [];

                            return (
                                participants.length > 0 &&
                                participants.every(function (user) {

                                    const participantId =
                                        typeof user === "object"
                                            ? user.id
                                            : user;

                                    return String(participantId) ===
                                        String(currentUser.id);

                                })
                            );

                        }
                    );

                    if (selfConversation) {

                        // Mövcud öz söhbətini aç.
                        openConversation(selfConversation.id);

                    } else {

                        // Öz söhbəti yoxdursa, yarat.
                        createConversation(currentUser.id);

                    }

                },

                error: function (xhr) {

                    console.error(
                        "Söhbətlər yüklənmədi:",
                        xhr.responseText
                    );

                }

            });

            return;
        }

        // =========================
        // OTHER EMPLOYEE CHAT
        // =========================

        createConversation(userId);

    });


    // =========================
    // CHAT CLICK
    // =========================

    $(document).on(
        "click",
        ".chat-item",
        function () {

            const conversationId =
                $(this)
                    .attr(
                        "data-conversation-id"
                    );

            if (!conversationId) {
                return;
            }

            window.location.href =
                "chat.html?conversation=" +
                encodeURIComponent(
                    conversationId
                );

        }
    );


    // =========================
    // PROFILE
    // =========================

    function loadProfile() {

        const currentUser =
            JSON.parse(
                localStorage.getItem(
                    "currentUser"
                )
            ) || null;


        if (!currentUser) {

            $("#profileUsername")
                .text("İstifadəçi");

            $("#usernameValue")
                .text("istifadəçi");

            $("#emailValue")
                .text("—");

            $("#joinedValue")
                .text("—");

            return;

        }


        const username =
            currentUser.username ||
            currentUser.name ||
            "İstifadəçi";


        $("#profileUsername")
            .text(username);

        $("#usernameValue")
            .text(username);

        $("#emailValue")
            .text(
                currentUser.email || "—"
            );

        $("#joinedValue")
            .text(
                currentUser.joined || "—"
            );

    }


    // =========================
    // AVATAR
    // =========================

    $("#avatarEdit").on(
        "click",
        function () {

            $("#avatarInput")
                .trigger("click");

        }
    );


    $("#avatarInput").on(
        "change",
        function () {

            const file =
                this.files[0];

            if (!file) {
                return;
            }


            const reader =
                new FileReader();


            reader.onload =
                function (event) {

                    $("#profileAvatarImage")
                        .attr(
                            "src",
                            event.target.result
                        )
                        .addClass("active");

                    $("#profileAvatarIcon")
                        .hide();

                };


            reader.readAsDataURL(file);

        }
    );


    // =========================
    // PROFILE SETTINGS
    // =========================

    $("#notificationsButton").on(
        "click",
        function () {

            alert("Bildirişlər bölməsi");

        }
    );


    $("#privacyButton").on(
        "click",
        function () {

            alert("Məxfilik bölməsi");

        }
    );


    $("#securityButton").on(
        "click",
        function () {

            alert("Təhlükəsizlik bölməsi");

        }
    );


    // =========================
    // LOGOUT
    // =========================

    $("#logoutButton").on(
        "click",
        function () {

            logoutUser();

        }
    );


    // =========================
    // INITIAL PAGE
    // =========================

    const savedPage =
        localStorage.getItem(
            "dmsCurrentPage"
        );

    showPage(
        savedPage || "chats"
    );

});