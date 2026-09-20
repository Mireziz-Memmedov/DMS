$(document).ready(function () {

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
        $("#contactsEmptyState").removeClass("active");


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

        // Profilə search düşməsin
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

        $("#contactsEmptyState").removeClass("active");

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

            let found = false;


            $(".contact-item").each(function () {

                const name = $(this)
                    .find(".contact-name")
                    .text()
                    .toLowerCase();

                const username = $(this)
                    .find(".contact-username")
                    .text()
                    .toLowerCase();


                if (
                    name.includes(value) ||
                    username.includes(value)
                ) {

                    $(this).show();

                    found = true;

                } else {

                    $(this).hide();

                }

            });


            if (value !== "" && !found) {

                $("#contactsEmptyState").addClass("active");

            } else {

                $("#contactsEmptyState").removeClass("active");

            }

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

        const name = $(this)
            .find(".chat-top h3")
            .text()
            .trim();

        console.log("Söhbət açıldı:", name);

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

        localStorage.removeItem("currentUser");
        localStorage.removeItem("selectedLanguage");
        localStorage.removeItem("dmsCurrentPage");

        window.location.href = "./index.html";
    });


    // =========================
    // INITIAL PAGE
    // =========================

    const savedPage = localStorage.getItem("dmsCurrentPage");

    showPage(savedPage || "chats");

});