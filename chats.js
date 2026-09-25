$(document).ready(function () {

    // =========================
    // LOAD EMPLOYEES
    // =========================

    function loadEmployees() {

        apiRequest({

            url: API_URL + "/api/employees/",
            type: "GET",

            success: function (employees) {

                $("#contactsList").empty();

                employees.forEach(function (employee) {

                    const fullName =
                        `${employee.first_name || ""} ${employee.last_name || ""}`.trim();

                    const name =
                        fullName || employee.username;

                    const contact = $("<div>")
                        .addClass("contact-item")
                        .attr("data-user-id", employee.id);

                    const avatar = $("<div>")
                        .addClass("contact-avatar")
                        .text(name.charAt(0).toUpperCase());

                    const info = $("<div>")
                        .addClass("contact-info");

                    const top = $("<div>")
                        .addClass("contact-top");

                    const contactName = $("<h3>")
                        .addClass("contact-name")
                        .text(name);

                    const position = $("<p>")
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

                    $("#contactsList").append(contact);

                });

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
    // LOAD CONVERSATIONS
    // =========================

    function loadConversations() {

        apiRequest({

            url: API_URL + "/api/conversations/",
            type: "GET",

            success: function (conversations) {

                $("#chatList").empty();

                if (!conversations.length) {

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

                    let otherParticipants =
                        participants.filter(function (user) {

                            if (!currentUser) {
                                return true;
                            }

                            return user.id !== currentUser.id;

                        });


                    if (!otherParticipants.length) {
                        otherParticipants = participants;
                    }


                    // =========================
                    // CHAT NAME
                    // =========================

                    const names =
                        otherParticipants.map(function (user) {

                            const fullName =
                                `${user.first_name || ""} ${user.last_name || ""}`.trim();

                            return fullName || user.username;

                        });


                    const chatName =
                        names.join(", ") ||
                        "Naməlum söhbət";


                    // =========================
                    // AVATAR
                    // =========================

                    const firstName =
                        otherParticipants[0]?.first_name || "";

                    const lastName =
                        otherParticipants[0]?.last_name || "";

                    const avatarText =
                        (
                            firstName.charAt(0) +
                            lastName.charAt(0)
                        ).toUpperCase() ||
                        chatName.charAt(0).toUpperCase();


                    // =========================
                    // CHAT ITEM
                    // =========================

                    const chatItem = $("<article>")
                        .addClass("chat-item")
                        .attr(
                            "data-conversation-id",
                            conversation.id
                        );


                    const avatar = $("<div>")
                        .addClass("chat-avatar")
                        .text(avatarText);


                    const content = $("<div>")
                        .addClass("chat-content");


                    const top = $("<div>")
                        .addClass("chat-top");


                    const title = $("<h3>")
                        .text(chatName);


                    const time = $("<time>")
                        .text(
                            formatConversationTime(
                                conversation.updated_at
                            )
                        );


                    const bottom = $("<div>")
                        .addClass("chat-bottom");


                    const lastMessage = $("<p>")
                        .text("Söhbət başladı");


                    top.append(title);
                    top.append(time);

                    bottom.append(lastMessage);

                    content.append(top);
                    content.append(bottom);

                    chatItem.append(avatar);
                    chatItem.append(content);

                    $("#chatList").append(chatItem);

                });

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


        if (sameDay) {

            return date.toLocaleTimeString(
                "az-AZ",
                {
                    hour: "2-digit",
                    minute: "2-digit"
                }
            );

        }


        return date.toLocaleDateString(
            "az-AZ",
            {
                day: "2-digit",
                month: "2-digit"
            }
        );

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

    $(document).on(
        "click",
        ".contact-item",
        function () {

            const userId =
                $(this).attr("data-user-id");

            if (!userId) {
                return;
            }

            apiRequest({

                url: API_URL + "/api/conversations/create/",
                type: "POST",

                contentType: "application/json",

                data: JSON.stringify({
                    participants: [parseInt(userId)]
                }),

                success: function (conversation) {

                    window.location.href =
                        "chat.html?conversation=" +
                        encodeURIComponent(
                            conversation.id
                        );

                },

                error: function (xhr) {

                    console.log(
                        "Söhbət yaradıla bilmədi:",
                        xhr.responseText
                    );

                }

            });

        }
    );


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