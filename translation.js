$(document).ready(function () {

    const translations = {

        az: {
            // LOGIN
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
            "login.secure": "Təhlükəsiz mesajlaşma sistemi",

            // PROFILE
            "profile.title": "Profil",
            "profile.status": "DMS istifadəçisi",

            "profile.account": "Hesab məlumatları",
            "profile.username": "İstifadəçi adı",
            "profile.email": "E-poçt",
            "profile.joined": "Qeydiyyat tarixi",

            "profile.settings": "Parametrlər",
            "profile.notifications": "Bildirişlər",
            "profile.notificationsDescription": "Mesaj və sistem bildirişləri",
            "profile.privacy": "Məxfilik",
            "profile.privacyDescription": "Hesab və məxfilik parametrləri",
            "profile.security": "Təhlükəsizlik",
            "profile.securityDescription": "Hesab təhlükəsizliyi",

            "profile.language": "Dil",
            "profile.languageSelect": "Tətbiq dili",

            "profile.logout": "Hesabdan çıx",

            "profile.footer": "Təhlükəsiz mesajlaşma sistemi",

            // CHATS

            "chats.search": "Axtar",
            "chats.language": "Dil",
            "chats.menu": "Menyu",

            "chats.subtitle": "Əməkdaşlararası mesajlaşma",

            "chats.searchPlaceholder": "Söhbət axtar...",

            "chats.title": "Mesajlar",
            "chats.description": "Əməkdaşlarla söhbətləriniz",

            "chats.notFound": "Söhbət tapılmadı",
            "chats.noResults": "Axtarışınıza uyğun söhbət yoxdur.",

            "chats.messages": "Mesajlar",
            "chats.employees": "Əməkdaşlar",
            "chats.profile": "Profil"
        },

        en: {
            // LOGIN
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
            "login.secure": "Secure messaging system",

            // PROFILE
            "profile.title": "Profile",
            "profile.status": "DMS User",

            "profile.account": "Account Information",
            "profile.username": "Username",
            "profile.email": "Email",
            "profile.joined": "Registration Date",

            "profile.settings": "Settings",
            "profile.notifications": "Notifications",
            "profile.notificationsDescription": "Messages and system notifications",
            "profile.privacy": "Privacy",
            "profile.privacyDescription": "Account and privacy settings",
            "profile.security": "Security",
            "profile.securityDescription": "Account security",

            "profile.language": "Language",
            "profile.languageSelect": "App Language",

            "profile.logout": "Log out",

            "profile.footer": "Secure messaging system",

            // CHATS

            "chats.search": "Search",
            "chats.language": "Language",
            "chats.menu": "Menu",

            "chats.subtitle": "Employee messaging",

            "chats.searchPlaceholder": "Search chats...",

            "chats.title": "Messages",
            "chats.description": "Your conversations with employees",

            "chats.notFound": "No chats found",
            "chats.noResults": "No conversations match your search.",

            "chats.messages": "Messages",
            "chats.employees": "Employees",
            "chats.profile": "Profile"
        },

        ru: {
            // LOGIN
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
            "login.secure": "Безопасная система обмена сообщениями",

            // PROFILE
            "profile.title": "Профиль",
            "profile.status": "Пользователь DMS",

            "profile.account": "Информация об аккаунте",
            "profile.username": "Имя пользователя",
            "profile.email": "Электронная почта",
            "profile.joined": "Дата регистрации",

            "profile.settings": "Настройки",
            "profile.notifications": "Уведомления",
            "profile.notificationsDescription": "Сообщения и системные уведомления",
            "profile.privacy": "Конфиденциальность",
            "profile.privacyDescription": "Настройки аккаунта и конфиденциальности",
            "profile.security": "Безопасность",
            "profile.securityDescription": "Безопасность аккаунта",

            "profile.language": "Язык",
            "profile.languageSelect": "Язык приложения",

            "profile.logout": "Выйти из аккаунта",

            "profile.footer": "Безопасная система обмена сообщениями",

            // CHATS

            "chats.search": "Поиск",
            "chats.language": "Язык",
            "chats.menu": "Меню",

            "chats.subtitle": "Обмен сообщениями между сотрудниками",

            "chats.searchPlaceholder": "Поиск чатов...",

            "chats.title": "Сообщения",
            "chats.description": "Ваши беседы с сотрудниками",

            "chats.notFound": "Чаты не найдены",
            "chats.noResults": "Нет бесед, соответствующих вашему поиску.",

            "chats.messages": "Сообщения",
            "chats.employees": "Сотрудники",
            "chats.profile": "Профиль"
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