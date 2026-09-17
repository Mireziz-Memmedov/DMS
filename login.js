$(document).ready(function () {

    // Password göstər / gizlət
    $("#passwordToggle").on("click", function () {

        const password = $("#password");
        const icon = $(this).find("i");

        if (password.attr("type") === "password") {

            password.attr("type", "text");

            icon
                .removeClass("fa-eye-slash")
                .addClass("fa-eye");

            $(this).attr("aria-label", "Şifrəni gizlət");

        } else {

            password.attr("type", "password");

            icon
                .removeClass("fa-eye")
                .addClass("fa-eye-slash");

            $(this).attr("aria-label", "Şifrəni göstər");
        }

    });

});