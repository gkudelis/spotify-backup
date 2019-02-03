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
        albumCopyPercentage: 0,
        trackCopyPercentage: 0,
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
        copyAlbumsAndTracks: function() {
            var vm = this;
            vm.copyAlbums().then(function() {
                return vm.copyTracks();
            });
        },
        copyAlbums: function() {
            var vm = this;
            vm.progressLog += 'Copying saved albums\n';
            var albumCount;
            var albumPageSize = 5;
            return fromSpotify.getAlbums(1).then(function(albumData) {
                // first find the number of albums
                albumCount = albumData.total;
                // create a list of offsets
                var offsets = [];
                for (var i = 0; i < albumCount; i += albumPageSize) {
                    offsets.unshift(i);
                }
                // queue album fetches
                var pushed = 0;
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
                        pushed += 1;
                        // resolve the load promise with another promise
                        albumLoadResolve(fromSpotify.getAlbums(albumPageSize, offset));
                    });
                }, Promise.resolve());
                // once all have been queued - queue album saves
                var batchesProcessed = 0;
                return offsets.reduce(function(p) {
                    return p.then(function() {
                        return pq.pop();
                    }).then(function(albumData) {
                        var albumIds = albumData.items.map(function(item) {
                            return item.album.id;
                        });
                        return toSpotify.saveAlbums(albumIds);
                    }).then(function() {
                        batchesProcessed += 1;
                        vm.albumCopyPercentage = Math.ceil((batchesProcessed / offsets.length) * 100);
                    });
                }, Promise.resolve());
            }).then(function() {
                vm.progressLog += 'Finished copying albums\n';
            });
        },
        copyTracks: function() {
            var vm = this;
            vm.progressLog += 'Copying saved tracks\n';
            var trackCount;
            var trackPageSize = 50;
            return fromSpotify.getTracks(1).then(function(trackData) {
                // first find the number of tracks
                trackCount = trackData.total;
                // create a list of offsets
                var offsets = [];
                for (var i = 0; i < trackCount; i += trackPageSize) {
                    offsets.unshift(i);
                }
                // queue track fetches
                offsets.reduce(function(p, offset) {
                    // set up a new unresolved promise for track results
                    var trackLoadResolve;
                    var trackLoad = new Promise(function(resolve, reject) {
                        trackLoadResolve = resolve;
                    });
                    // wait for the queue to accept our push
                    return p.then(function() {
                        return pq.push(trackLoad);
                    }).then(function() {
                        // resolve the load promise with another promise
                        trackLoadResolve(fromSpotify.getTracks(trackPageSize, offset));
                    });
                }, Promise.resolve());
                // once all have been queued - queue track saves
                var batchesProcessed = 0;
                return offsets.reduce(function(p) {
                    return p.then(function() {
                        return pq.pop();
                    }).then(function(trackData) {
                        var trackIds = trackData.items.map(function(item) {
                            return item.track.id;
                        });
                        return toSpotify.saveTracks(trackIds);
                    }).then(function() {
                        batchesProcessed += 1;
                        vm.trackCopyPercentage = Math.ceil((batchesProcessed / offsets.length) * 100);
                    });
                }, Promise.resolve());
            }).then(function() {
                vm.progressLog += 'Finished copying tracks\n';
            });
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
