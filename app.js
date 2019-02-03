var spotifyClientId = 'f6ebcd26b8d948fe908c690e2cc718da';
var spotifyRateLimitLock = null;

var fromSpotify =  new Spotify(spotifyClientId, spotifyRateLimitLock);
var toSpotify = new Spotify(spotifyClientId, spotifyRateLimitLock);

var pq = new PromisQ(10);

new Vue({
    el: '#app',
    data: {
        fromAuthComplete: false,
        toAuthComplete: false,
        albumCopyPercentage: 80,
        songCopyPercentage: 0,
        progressLog: 'Waiting for authentication\n',
        fromAccName: null,
        toAccName: null
    },
    created: function() {
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
        // make an object representing the cookies
        var cookies = document.cookie.split(';').reduce(function(acc, c) {
            var kv = c.split('=');
            acc[kv[0].trim()] = decodeURIComponent(kv[1]);
            return acc;
        }, {});
        // check and complete authentications
        if (cookies.hasOwnProperty('authFrom')) {
            vm.progressLog += 'Authenticated "from" account\n';
            fromSpotify.finishAuth(cookies['authFrom']);
            vm.fromAuthComplete = true;
            fromSpotify.getMe()
                .then(function(data) {
                    vm.fromAccName = data.display_name;
                }).catch(console.log.bind(console));
        }
        if (cookies.hasOwnProperty('authTo')) {
            vm.progressLog += 'Authenticated "to" account\n';
            toSpotify.finishAuth(cookies['authTo']);
            vm.toAuthComplete = true;
            toSpotify.getMe()
                .then(function(data) {
                    vm.toAccName = data.display_name;
                }).catch(console.log.bind(console));
        }
    },
    methods: {
        authFrom: function() {
            fromSpotify.startAuth({
                scope: 'user-library-read',
                state: 'authFrom'
            });
        },
        authTo: function() {
            toSpotify.startAuth({
                scope: 'user-library-modify',
                state: 'authTo'
            });
        },
        copyAlbumsAndSongs: function() {
            var vm = this;
            vm.copyAlbums().then(function() {
                return vm.copySongs();
            });
        },
        copyAlbums: function() {
            var vm = this;
            vm.progressLog += 'Copying saved albums\n';
            var albumCount;
            var albumPageSize = 10;
            return fromSpotify.getAlbums(1).then(function(albumData) {
                // first find the number of albums
                console.log(albumData);
                albumCount = albumData.total;
                // create a list of offsets
                var offsets = [];
                for (var i = 0; i < albumCount; i += albumPageSize) {
                    offsets.unshift(i);
                }
                // queue album fetches
                offsets.reduce(function(p, offset) {
                    // set up a new unresolved promise for album results
                    var albumLoadResolve;
                    var albumLoad = new Promise(function(resolve, reject) {
                        albumLoadResolve = resolve;
                    });
                    // wait for the queue to accept our push
                    return p.then(function() {
                        return pq.push(albumLoad);
                    }).then(function() {
                        // resolve the load promise with another promise
                        console.log('getting ' + offset + ' -> ' + (offset + albumPageSize));
                        albumLoadResolve(fromSpotify.getAlbums(albumPageSize, offset));
                    });
                }, Promise.resolve());
                // once all have been queued - queue album saves
                return offsets.reduce(function(p) {
                    return p.then(function() {
                        return pq.pop();
                    }).then(function(albumData) {
                        console.log('fetched, limit: ' + albumData.limit + ', offset: ' + albumData.offset);
                    });
                }, Promise.resolve());
            });
        },
        copySongs: function() {
            var vm = this;
            vm.progressLog += 'Copying saved songs\n';
        }
    }
});

function queryStringToObject (qs) {
    return qs.split('&').reduce(function(acc, val) {
        var kv = val.split('=');
        acc[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1]);
        return acc;
    }, {});
}
