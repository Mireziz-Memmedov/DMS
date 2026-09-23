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


    // Daxil ol
    $('#loginButton').click(function (e) {

        e.preventDefault();

        const username = $('#username').val().trim();
        const password = $('#password').val().trim();

        if (username === '') {
            $('#username').focus();
            return;
        }

        if (password === '') {
            $('#password').focus();
            return;
        }


        // Backend login
        $.ajax({

            url: 'https://dms-be-fr6n.onrender.com/api/login/',
            type: 'POST',

            contentType: 'application/json',

            data: JSON.stringify({
                username: username,
                password: password
            }),

            success: function (response) {

                // JWT tokenləri yadda saxla
                localStorage.setItem('accessToken', response.access);
                localStorage.setItem('refreshToken', response.refresh);

                // Profil / chats səhifəsinə keç
                window.location.href = "./chats.html";
            },

            error: function (xhr) {

                if (xhr.status === 401) {
                    alert("İstifadəçi adı və ya şifrə yanlışdır.");
                } else {
                    alert("Giriş zamanı xəta baş verdi.");
                }
            }

        });

    });

});