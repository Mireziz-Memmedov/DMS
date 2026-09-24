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
                        .text(employee.position || "DMS istifadəçisi");

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
    // PAGE NAVIGATION
    // =========================

    function showPage(page) {

        localStorage.setItem("dmsCurrentPage", page);

        $(".page-section").removeClass("active");
        $(".nav-item").removeClass("active");

        // SEARCH RESET
        $("#searchBox").removeClass("active");
        $("#chatSearch").val("");

        $(".chat-item").show();
        $(".contact-item").show();

        $("#emptyState").removeClass("active");


        // =========================
        // CHATS
        // =========================

        if (page === "chats") {

            $("#chatsPage").addClass("active");

            $('.nav-item[data-page="chats"]')
                .addClass("active");

            $("#searchButton").show();

        }


        // =========================
        // CONTACTS
        // =========================

        else if (page === "contacts") {

            $("#contactsPage").addClass("active");

            $('.nav-item[data-page="contacts"]')
                .addClass("active");

            $("#searchButton").show();

            loadEmployees();

        }


        // =========================
        // PROFILE
        // =========================

        else if (page === "profile") {

            $("#profilePage").addClass("active");

            $('.nav-item[data-page="profile"]')
                .addClass("active");

            // PROFİLDƏ SEARCH YOXDUR
            $("#searchButton").hide();

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

    $(".nav-item").on("click", function () {

        const page = $(this).data("page");

        showPage(page);

    });


    // =========================
    // SEARCH BUTTON
    // =========================

    $("#searchButton").on("click", function () {

        // PROFİLDƏ SEARCH YOXDUR
        if ($("#profilePage").hasClass("active")) {
            return;
        }

        $("#searchBox").addClass("active");

        $("#chatSearch").trigger("focus");

    });


    // =========================
    // CLOSE SEARCH
    // =========================

    $("#closeSearch").on("click", function () {

        $("#chatSearch").val("");

        $("#searchBox").removeClass("active");

        $(".chat-item").show();

        $(".contact-item").show();

        $("#emptyState").removeClass("active");

    });


    // =========================
    // SEARCH INPUT
    // =========================

    $("#chatSearch").on("input", function () {

        const value = $(this)
            .val()
            .toLowerCase()
            .trim();


        // =========================
        // CHAT SEARCH
        // =========================

        if ($("#chatsPage").hasClass("active")) {

            let found = false;


            $(".chat-item").each(function () {

                const name = $(this)
                    .find(".chat-top h3")
                    .text()
                    .toLowerCase();

                const message = $(this)
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

            });


            if (value !== "" && !found) {

                $("#emptyState").addClass("active");

            } else {

                $("#emptyState").removeClass("active");

            }

        }


        // =========================
        // CONTACT SEARCH
        // =========================

        else if ($("#contactsPage").hasClass("active")) {

            $(".contact-item").each(function () {

                const name = $(this)
                    .find(".contact-name")
                    .text()
                    .toLowerCase();

                const position = $(this)
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

            });

        }

    });


    // =========================
    // NEW CHAT
    // =========================

    $("#newChatButton").on("click", function () {

        showPage("contacts");

    });


    // =========================
    // CHAT CLICK
    // =========================

    $(".chat-item").on("click", function () {

        const userName = $(this)
            .find(".chat-top h3")
            .text()
            .trim();

        window.location.href =
            "chat.html?user=" + encodeURIComponent(userName);

    });


    // =========================
    // PROFILE
    // =========================

    function loadProfile() {

        const currentUser =
            JSON.parse(
                localStorage.getItem("currentUser")
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

    $("#avatarEdit").on("click", function () {

        $("#avatarInput").trigger("click");

    });


    $("#avatarInput").on("change", function () {

        const file = this.files[0];

        if (!file) {
            return;
        }


        const reader = new FileReader();


        reader.onload = function (event) {

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

    });


    // =========================
    // PROFILE SETTINGS
    // =========================

    $("#notificationsButton").on("click", function () {

        alert("Bildirişlər bölməsi");

    });


    $("#privacyButton").on("click", function () {

        alert("Məxfilik bölməsi");

    });


    $("#securityButton").on("click", function () {

        alert("Təhlükəsizlik bölməsi");

    });


    // =========================
    // LOGOUT
    // =========================

    $("#logoutButton").on("click", function () {

        logoutUser();

    });


    // =========================
    // INITIAL PAGE
    // =========================

    const savedPage =
        localStorage.getItem("dmsCurrentPage");

    showPage(savedPage || "chats");

});