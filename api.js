const API_URL = "https://dms-be-fr6n.onrender.com";


// =========================
// API REQUEST
// =========================

function apiRequest(options) {

    options.headers = options.headers || {};

    const token = localStorage.getItem("accessToken");

    if (token) {
        options.headers["Authorization"] = "Bearer " + token;
    }

    return $.ajax(options).then(null, function (xhr) {

        if (xhr.status !== 401) {
            return $.Deferred().reject(xhr).promise();
        }

        const refreshToken = localStorage.getItem("refreshToken");

        if (!refreshToken) {
            logoutUser();
            return $.Deferred().reject(xhr).promise();
        }

        return $.ajax({

            url: API_URL + "/api/token/refresh/",
            type: "POST",
            contentType: "application/json",

            data: JSON.stringify({
                refresh: refreshToken
            })

        }).then(function (response) {

            localStorage.setItem("accessToken", response.access);

            options.headers["Authorization"] =
                "Bearer " + response.access;

            // İlkin sorğunu yeni tokenlə təkrar göndər.
            return $.ajax(options);

        }, function (refreshError) {

            logoutUser();

            return $.Deferred().reject(refreshError).promise();

        });

    });

}

// ==========================================
// SAVE CALL HISTORY
// ==========================================

function saveCallHistory() {

    if (
        !isCallInitiator ||
        !callStartedAt ||
        callHistorySaved ||
        !callConversationId
    ) {
        return;
    }

    const duration = Math.floor(
        (Date.now() - callStartedAt) / 1000
    );

    if (duration <= 0) {
        return;
    }

    callHistorySaved = true;

    apiRequest({
        url: API_URL + "/api/conversations/" +
            callConversationId + "/calls/create/",

        type: "POST",

        contentType: "application/json",

        data: JSON.stringify({
            call_duration: duration
        })

    })
        .done(function (response) {

            console.log("Zəng tarixçəsi yadda saxlanıldı:", response);

        })
        .fail(function (xhr) {

            callHistorySaved = false;

            console.error(
                "Zəng tarixçəsi yadda saxlanılmadı:",
                xhr.responseText
            );

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