// CSRF: add the per-session token (from <meta name="csrf-token">) to every
// same-origin fetch() that isn't GET/HEAD/OPTIONS. The server rejects
// state-changing requests without it (403).
(function () {
    const meta = document.querySelector('meta[name="csrf-token"]');
    const token = meta ? meta.getAttribute('content') : '';
    const originalFetch = window.fetch.bind(window);
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];

    window.fetch = function (input, init) {
        init = init || {};
        const isRequest = input instanceof Request;
        const method = (init.method || (isRequest ? input.method : 'GET')).toUpperCase();
        const url = new URL(isRequest ? input.url : input, window.location.href);

        // Only same-origin, so the token never leaks to other sites
        if (!safeMethods.includes(method) && url.origin === window.location.origin) {
            const headers = new Headers(init.headers || (isRequest ? input.headers : undefined));
            headers.set('X-CSRF-Token', token);
            init = Object.assign({}, init, { headers });
        }
        return originalFetch(input, init);
    };
})();
