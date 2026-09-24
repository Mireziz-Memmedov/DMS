const API_URL = "https://dms-be-fr6n.onrender.com";


// =========================
// API REQUEST
// =========================

function apiRequest(options) {

    const token = localStorage.getItem("accessToken");

    options.headers = options.headers || {};

    if (token) {
        options.headers["Authorization"] = "Bearer " + token;
    }

    return $.ajax(options).fail(function (xhr) {

        if (xhr.status !== 401) {
            return;
        }

        const refreshToken =
            localStorage.getItem("refreshToken");

        if (!refreshToken) {

            logoutUser();

            return;
        }

        $.ajax({

            url: API_URL + "/api/token/refresh/",
            type: "POST",

            contentType: "application/json",

            data: JSON.stringify({
                refresh: refreshToken
            }),

            success: function (response) {

                localStorage.setItem(
                    "accessToken",
                    response.access
                );

                options.headers["Authorization"] =
                    "Bearer " + response.access;

                $.ajax(options);
            },

            error: function () {

                logoutUser();
            }

        });

    });

}


// =========================
// LOGOUT
// =========================

function logoutUser() {

    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("currentUser");
    localStorage.removeItem("dmsCurrentPage");

    window.location.href = "./index.html";
}