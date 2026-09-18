$(document).ready(function () {

    // =========================
    // SEARCH
    // =========================

    $("#searchButton").on("click", function () {
        $("#searchBox").addClass("active");
        $("#chatSearch").trigger("focus");
    });

    $("#closeSearch").on("click", function () {
        $("#chatSearch").val("");
        $("#searchBox").removeClass("active");

        $(".chat-item").show();
        $("#emptyState").removeClass("active");
    });


    $("#chatSearch").on("input", function () {

        const value = $(this).val().toLowerCase().trim();
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
    });

    // =========================
    // NEW CHAT
    // =========================

    $("#newChatButton").on("click", function () {

        // Sonradan əməkdaşlar səhifəsinə yönləndirə bilərik
        window.location.href = "contacts.html";
    });


    // =========================
    // CONTACTS
    // =========================

    $("#contactsButton").on("click", function () {
        window.location.href = "contacts.html";
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

        // Sonradan:
        // window.location.href = "chat.html?id=...";
    });

    // =========================
    // MENU
    // =========================

    $("#menuButton").on("click", function () {

        // Sonradan dropdown menyu əlavə edə bilərik.
        console.log("Menu açıldı");
    });

});