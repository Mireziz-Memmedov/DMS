$(document).ready(function () {

    // ==========================================
    // CALL WEBSOCKET CONFIGURATION
    // ==========================================

    let callSocket = null;
    let reconnectTimer = null;
    let reconnectDelay = 1000;
    let manuallyClosed = false;

    const MAX_RECONNECT_DELAY = 10000;

    const BACKEND_URL = "https://dms-be-fr6n.onrender.com";

    const CALL_SOCKET_URL = new URL(BACKEND_URL);

    CALL_SOCKET_URL.protocol =
        CALL_SOCKET_URL.protocol === "https:"
            ? "wss:"
            : "ws:";

    CALL_SOCKET_URL.pathname = "/ws/call/";

    const callSignalTypes = [
        "call_offer",
        "call_answer",
        "ice_candidate",
        "call_reject",
        "call_end",
        "call_busy"
    ];


    // ==========================================
    // GET CURRENT USER
    // ==========================================

    function getCurrentUser() {

        if (window.currentUser) {
            return window.currentUser;
        }

        try {

            const storedUser =
                localStorage.getItem("currentUser");

            if (storedUser) {
                return JSON.parse(storedUser);
            }

        } catch (error) {

            console.error(
                "İstifadəçi məlumatı oxunmadı:",
                error
            );

        }

        return null;
    }


    // ==========================================
    // CONNECT CALL WEBSOCKET
    // ==========================================

    function connectCallSocket() {

        const accessToken =
            localStorage.getItem("accessToken");

        if (!accessToken) {
            return;
        }

        if (
            callSocket &&
            (
                callSocket.readyState === WebSocket.OPEN ||
                callSocket.readyState === WebSocket.CONNECTING
            )
        ) {
            return;
        }

        manuallyClosed = false;

        const socketUrl = new URL(
            CALL_SOCKET_URL.toString()
        );

        socketUrl.searchParams.set(
            "token",
            accessToken
        );

        try {

            callSocket = new WebSocket(
                socketUrl.toString()
            );

        } catch (error) {

            console.error(
                "Call WebSocket yaradıla bilmədi:",
                error
            );

            scheduleReconnect();

            return;
        }


        // ==========================================
        // CONNECTION OPEN
        // ==========================================

        callSocket.onopen = function () {

            reconnectDelay = 1000;

            console.log(
                "Call WebSocket bağlantısı quruldu."
            );

        };


        // ==========================================
        // RECEIVE CALL SIGNALS
        // ==========================================

        callSocket.onmessage = function (event) {

            let data;

            try {

                data = JSON.parse(event.data);

            } catch (error) {

                console.error(
                    "Zəng siqnalı oxunmadı:",
                    error
                );

                return;
            }

            if (
                !data ||
                typeof data !== "object" ||
                !callSignalTypes.includes(data.type)
            ) {
                return;
            }

            window.dispatchEvent(
                new CustomEvent(
                    "dms:call-signal",
                    {
                        detail: data
                    }
                )
            );

        };


        // ==========================================
        // CONNECTION CLOSED
        // ==========================================

        callSocket.onclose = function () {

            console.warn(
                "Call WebSocket bağlantısı bağlandı."
            );

            callSocket = null;

            if (!manuallyClosed) {
                scheduleReconnect();
            }

        };


        // ==========================================
        // CONNECTION ERROR
        // ==========================================

        callSocket.onerror = function (error) {

            console.error(
                "Call WebSocket bağlantı xətası:",
                error
            );

        };

    }


    // ==========================================
    // RECONNECT
    // ==========================================

    function scheduleReconnect() {

        if (
            manuallyClosed ||
            reconnectTimer !== null
        ) {
            return;
        }

        reconnectTimer = setTimeout(function () {

            reconnectTimer = null;

            connectCallSocket();

            reconnectDelay = Math.min(
                reconnectDelay * 2,
                MAX_RECONNECT_DELAY
            );

        }, reconnectDelay);

    }


    // ==========================================
    // SEND CALL SIGNAL
    // ==========================================

    function sendSignal(signal) {

        if (
            !signal ||
            typeof signal !== "object" ||
            !callSignalTypes.includes(signal.type)
        ) {

            console.error(
                "Göndəriləcək zəng siqnalı düzgün deyil."
            );

            return false;
        }

        if (
            !callSocket ||
            callSocket.readyState !== WebSocket.OPEN
        ) {

            console.warn(
                "Zəng WebSocket bağlantısı hazır deyil."
            );

            return false;
        }

        try {

            callSocket.send(
                JSON.stringify(signal)
            );

            return true;

        } catch (error) {

            console.error(
                "Zəng siqnalı göndərilmədi:",
                error
            );

            return false;
        }

    }


    // ==========================================
    // CLOSE CONNECTION
    // ==========================================

    function closeCallSocket() {

        manuallyClosed = true;

        if (reconnectTimer !== null) {

            clearTimeout(reconnectTimer);

            reconnectTimer = null;

        }

        if (callSocket) {

            const socket = callSocket;

            callSocket = null;

            socket.close();

        }

    }


    // ==========================================
    // PUBLIC API
    // ==========================================

    window.DMSCallSocket = {

        connect: connectCallSocket,

        getSocket: function () {
            return callSocket;
        },

        getCurrentUser: getCurrentUser,

        sendSignal: sendSignal,

        close: closeCallSocket

    };


    // ==========================================
    // INITIAL CONNECTION
    // ==========================================

    connectCallSocket();


    // ==========================================
    // RECONNECT WHEN PAGE BECOMES VISIBLE
    // ==========================================

    document.addEventListener(
        "visibilitychange",
        function () {

            if (
                document.visibilityState === "visible" &&
                (
                    !callSocket ||
                    callSocket.readyState === WebSocket.CLOSED
                )
            ) {

                connectCallSocket();

            }

        }
    );


    // ==========================================
    // RECONNECT AFTER NETWORK RETURNS
    // ==========================================

    window.addEventListener(
        "online",
        function () {

            if (
                !callSocket ||
                callSocket.readyState === WebSocket.CLOSED
            ) {

                connectCallSocket();

            }

        }
    );


    // ==========================================
    // CLOSE ON PAGE EXIT
    // ==========================================

    window.addEventListener(
        "beforeunload",
        function () {

            closeCallSocket();

        }
    );

});
