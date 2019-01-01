var spotifyEndpoint = 'https://api.spotify.com/v1';

new Vue({
    el: '#app',
    data: {
        spotifyClientId: 'f6ebcd26b8d948fe908c690e2cc718da',
        fromAuthToken: null,
        toAuthToken: null,
        albumCopyPercentage: 80,
        songCopyPercentage: 0,
        progressLog: 'Waiting for authentication\n',
        fromAccName: null,
        toAccName: null
    },
    computed: {
        fromAuthComplete: function () { return !!this.fromAuthToken; },
        toAuthComplete: function () { return !!this.toAuthToken; },
        fromAxios: function () {
            if (!this.fromAuthComplete) return null;
            var ai = axios.create({ baseURL: spotifyEndpoint });
            ai.defaults.headers.common['Authorization'] = 'Bearer ' + this.fromAuthToken;
            return ai;
        },
        toAxios: function () {
            if (!this.toAuthComplete) return null;
            var ai = axios.create({ baseURL: spotifyEndpoint });
            ai.defaults.headers.common['Authorization'] = 'Bearer ' + this.toAuthToken;
            return ai;
        }
    },
    created: function () {
        var vm = this;
        // get auth tokens from querystring
        var fragment = window.location.hash.substr(1);
        var params = queryStringToObject(fragment);
        if (params.hasOwnProperty('access_token')) {
            if (params['state'] === 'authFrom') {
                document.cookie = 'authFrom=' + encodeURIComponent(params['access_token']);
            } else if (params['state'] === 'authTo') {
                document.cookie = 'authTo=' + encodeURIComponent(params['access_token']);
            } else console.log('This is strange...');
            document.location.replace('#');
        }
        // check which authentications have been completed
        var cookies = document.cookie.split(';').reduce(function (acc, c) {
            var kv = c.split('=');
            acc[kv[0].trim()] = decodeURIComponent(kv[1]);
            return acc;
        }, {});
        // if auth is done get the account names (these could be computed
        // properties using async-computed-properties plugin)
        if (cookies.hasOwnProperty('authFrom')) {
            vm.progressLog += 'Authenticated "from" account\n';
            vm.fromAuthToken = cookies['authFrom'];
            vm.fromAxios.get('/me')
                .then(function (response) {
                    vm.fromAccName = response.data.display_name;
                }).catch(console.log.bind(console));
        }
        if (cookies.hasOwnProperty('authTo')) {
            vm.progressLog += 'Authenticated "to" account\n';
            vm.toAuthToken = cookies['authTo'];
            vm.toAxios.get('/me')
                .then(function (response) {
                    vm.toAccName = response.data.display_name;
                }).catch(console.log.bind(console));
        }
    },
    methods: {
        authFrom: function () {
            var qs = objectToQueryString({
                client_id: this.spotifyClientId,
                response_type: 'token',
                redirect_uri: 'http://ec2-52-210-180-146.eu-west-1.compute.amazonaws.com:8000/',
                state: 'authFrom'
            });
            var newURI = 'https://accounts.spotify.com/authorize/?' + qs;
            window.location.replace(newURI);
        },
        authTo: function () {
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

function objectToQueryString (o) {
    var qs = Object
        .keys(o)
        .map(function (k) {
            return encodeURIComponent(k) + '=' + encodeURIComponent(o[k]);
        })
        .join('&');
    return qs;
}

function queryStringToObject (qs) {
    return qs.split('&').reduce(function (acc, val) {
        var kv = val.split('=');
        acc[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1]);
        return acc;
    }, {});
}
