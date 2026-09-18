$(document).ready(function () {

    // Geri qayıt
    $('#backButton').click(function () {
        window.history.back();
    });


    // Avatar dəyişdirmə düyməsi
    $('#avatarEditButton').click(function () {
        $('#avatarInput').click();
    });


    // Avatar seçildikdə
    $('#avatarInput').change(function () {
        const file = this.files[0];

        if (!file) {
            return;
        }

        const reader = new FileReader();

        reader.onload = function (e) {
            $('#profileAvatar').attr('src', e.target.result);
        };

        reader.readAsDataURL(file);
    });


    // Bildirişlər
    $('#notificationsButton').click(function () {
        alert('Bildirişlər bölməsi');
    });


    // Məxfilik
    $('#privacyButton').click(function () {
        alert('Məxfilik bölməsi');
    });


    // Təhlükəsizlik
    $('#securityButton').click(function () {
        alert('Təhlükəsizlik bölməsi');
    });


    // Çıxış
    $('#logoutButton').click(function () {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('selectedLanguage');

        window.location.href = './index.html';
    });

});