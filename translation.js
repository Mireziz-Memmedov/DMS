$(document).ready(function () {

    const translations = {

        az: {
            "login.title": "Xoş gəlmisiniz",
            "login.subtitle": "DMS hesabınıza daxil olun",
            "login.username": "İstifadəçi adı",
            "login.usernamePlaceholder": "İstifadəçi adınızı daxil edin",
            "login.password": "Şifrə",
            "login.passwordPlaceholder": "Şifrənizi daxil edin",
            "login.remember": "Məni xatırla",
            "login.forgotPassword": "Şifrəni unutmusunuz?",
            "login.button": "Daxil ol",
            "login.noAccount": "Hesabınız yoxdur?",
            "login.register": "Qeydiyyatdan keçin",
            "login.secure": "Təhlükəsiz mesajlaşma sistemi"
        },

        en: {
            "login.title": "Welcome",
            "login.subtitle": "Sign in to your DMS account",
            "login.username": "Username",
            "login.usernamePlaceholder": "Enter your username",
            "login.password": "Password",
            "login.passwordPlaceholder": "Enter your password",
            "login.remember": "Remember me",
            "login.forgotPassword": "Forgot password?",
            "login.button": "Sign in",
            "login.noAccount": "Don't have an account?",
            "login.register": "Create an account",
            "login.secure": "Secure messaging system"
        },

        ru: {
            "login.title": "Добро пожаловать",
            "login.subtitle": "Войдите в свой аккаунт DMS",
            "login.username": "Имя пользователя",
            "login.usernamePlaceholder": "Введите имя пользователя",
            "login.password": "Пароль",
            "login.passwordPlaceholder": "Введите пароль",
            "login.remember": "Запомнить меня",
            "login.forgotPassword": "Забыли пароль?",
            "login.button": "Войти",
            "login.noAccount": "Нет аккаунта?",
            "login.register": "Зарегистрироваться",
            "login.secure": "Безопасная система обмена сообщениями"
        }

    };


    let currentLanguage =
        localStorage.getItem("dmsLanguage") || "az";


    function translatePage(language) {

        const data = translations[language];

        if (!data) return;

        $("[data-i18n]").each(function () {

            const key = $(this).attr("data-i18n");

            if (data[key]) {
                $(this).text(data[key]);
            }

        });

        $("[data-i18n-placeholder]").each(function () {

            const key = $(this).attr("data-i18n-placeholder");

            if (data[key]) {
                $(this).attr("placeholder", data[key]);
            }

        });

        $("#currentLanguage").text(language.toUpperCase());

        $("html").attr("lang", language);

        localStorage.setItem("dmsLanguage", language);
    }


    // İlk dil
    translatePage(currentLanguage);


    // Dil menyusunu aç
    $("#languageButton").on("click", function () {
        $("#languageMenu").toggleClass("active");
    });


    // Dil seç
    $("#languageMenu button").on("click", function () {

        const language = $(this).data("language");

        currentLanguage = language;

        translatePage(language);

        $("#languageMenu").removeClass("active");
    });


    // Menyudan kənara klik
    $(document).on("click", function (event) {

        if (
            !$(event.target).closest("#languageButton").length &&
            !$(event.target).closest("#languageMenu").length
        ) {
            $("#languageMenu").removeClass("active");
        }

    });

});