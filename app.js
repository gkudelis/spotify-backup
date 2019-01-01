new Vue({
    el: '#app',
    data: {
        spotifyClientId: 'f6ebcd26b8d948fe908c690e2cc718da',
        fromAuthComplete: false,
        fromAuthToken: '',
        toAuthComplete: false,
        toAuthToken: '',
        albumCopyPercentage: 80,
        songCopyPercentage: 0,
        progressLog: 'Waiting for authentication'
    },
    created: function() {
        // get auth tokens from querystring
        var fragment = window.location.hash.substr(1);
        var params = queryStringToObject(fragment);
        if (params.hasOwnProperty('access_token')) {
            if (params['state'] === 'authFrom') {
                document.cookie = 'authFrom=' + encodeURIComponent(params['access_token']);
            } else if (params['state'] === 'authTo') {
                document.cookie = 'authTo=' + encodeURIComponent(params['access_token']);
            } else console.log('This is strange...');
        }
        // check which authentications have been completed
        var cookies = document.cookie.split(';').reduce(function (acc, c) {
            var kv = c.split('=');
            acc[kv[0].trim()] = decodeURIComponent(kv[1]);
            return acc;
        }, {});
        console.log(cookies);
        if (cookies.hasOwnProperty('authFrom')) {
            this.fromAuthComplete = true;
            this.fromAuthToken = cookies['authFrom'];
        }
        if (cookies.hasOwnProperty('authTo')) {
            this.toAuthComplete = true;
            this.toAuthToken = cookies['authTo'];
        }
    },
    methods: {
        authFrom: function() {
            var qs = objectToQueryString({
                client_id: this.spotifyClientId,
                response_type: 'token',
                redirect_uri: 'http://ec2-52-210-180-146.eu-west-1.compute.amazonaws.com:8000/',
                state: 'authFrom'
            });
            var newURI = 'https://accounts.spotify.com/authorize/?' + qs;
            window.location.replace(newURI);
        },
        authTo: function() {
            var qs = objectToQueryString({
                client_id: this.spotifyClientId,
                response_type: 'token',
                redirect_uri: 'http://ec2-52-210-180-146.eu-west-1.compute.amazonaws.com:8000/',
                state: 'authTo'
            });
            var newURI = 'https://accounts.spotify.com/authorize/?' + qs;
            window.location.replace(newURI);
        }
    }
});

function objectToQueryString(o) {
    var qs = Object
        .keys(o)
        .map(function (k) {
            return encodeURIComponent(k) + '=' + encodeURIComponent(o[k]);
        })
        .join('&');
    return qs;
}

function queryStringToObject(qs) {
    return qs.split('&').reduce(function (acc, val) {
        var kv = val.split('=');
        acc[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1]);
        return acc;
    }, {});
}
