$(document).ready(function () {

    const body = $("body");
    const button = $("#darkModeButton");

    // Yadda saxlanmış rejimi götür
    const savedMode = localStorage.getItem("dmsTheme");

    if (savedMode === "dark") {
        body.addClass("dark-mode");

        button.find("i")
            .removeClass("fa-moon")
            .addClass("fa-sun");
    }

    // Dark mode dəyiş
    button.on("click", function () {

        body.toggleClass("dark-mode");

        const isDark = body.hasClass("dark-mode");

        localStorage.setItem(
            "dmsTheme",
            isDark ? "dark" : "light"
        );

        button.find("i")
            .toggleClass("fa-moon", !isDark)
            .toggleClass("fa-sun", isDark);
    });

});