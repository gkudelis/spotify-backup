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
        trackLoadPercentage: 0,
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
        copyTracks: function() {
            var vm = this;
            vm.progressLog += 'Loading tracks\n';
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
                // queue track fetches (these are happening in parallel)
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
                // once all have been queued - collect results from the queue
                var batchesProcessed = 0;
                var allSavedTracks = [];
                return offsets.reduce(function(p) {
                    return p.then(function() {
                        return pq.pop();
                    }).then(function(trackData) {
                        batchesProcessed += 1;
                        vm.trackLoadPercentage = Math.ceil((batchesProcessed / offsets.length) * 100);
                        // add current batch to the full list of tracks
                        trackData.items.reduce(function(savedTrackAcc, item) {
                            savedTrackAcc.push({
                                id: item.track.id,
                                added_at: item.added_at
                            });
                            return savedTrackAcc;
                        }, allSavedTracks);
                        return allSavedTracks;
                    });
                }, Promise.resolve());
            }).then(function(allSavedTracks) {
                vm.progressLog += 'Finished loading tracks\n';
                // sort in ascending order by added date
                var sortedTracks = allSavedTracks.sort(function(a, b) {
                    return new Date(a.added_at) - new Date(b.added_at);
                });
                // group by added date, also split up groups if larger than 50
                var groupedTracks = sortedTracks.reduce(function(acc, track) {
                    if (track.added_at === acc.lastDate &&
                            acc.groups[acc.groups.length - 1].length < 50) {
                        acc.groups[acc.groups.length - 1].push(track.id);
                    } else {
                        acc.groups.push([track.id]);
                    }
                    return {
                        lastDate: track.added_at,
                        groups: acc.groups
                    };
                }, {lastDate: null, groups: []}).groups;
                vm.progressLog += 'Saving tracks\n';
                // save tracks (groups are ordererd by date originally saved)
                var batchesProcessed = 0;
                return groupedTracks.reduce(function(p, trackIds) {
                    return p.then(function() {
                        return toSpotify.saveTracks(trackIds);
                    }).then(function() {
                        batchesProcessed += 1;
                        vm.trackCopyPercentage = Math.ceil((batchesProcessed / groupedTracks.length) * 100);
                    });
                }, Promise.resolve());
            }).then(function() {
                vm.progressLog += 'Finished saving tracks\n';
            });
        },
        //wipeToAccountTracks: function() {
        //    var vm = this;
        //    vm.progressLog += 'Wiping "to" account tracks\n';
        //    var trackCount;
        //    var trackPageSize = 50;
        //    return toSpotify.getTracks(1).then(function(trackData) {
        //        // first find the number of tracks
        //        trackCount = trackData.total;
        //        // create a list of offsets
        //        var offsets = [];
        //        for (var i = 0; i < trackCount; i += trackPageSize) {
        //            offsets.unshift(i);
        //        }
        //        // queue track fetches
        //        offsets.reduce(function(p, offset) {
        //            // set up a new unresolved promise for track results
        //            var trackLoadResolve;
        //            var trackLoad = new Promise(function(resolve, reject) {
        //                trackLoadResolve = resolve;
        //            });
        //            // wait for the queue to accept our push
        //            return p.then(function() {
        //                return pq.push(trackLoad);
        //            }).then(function() {
        //                // resolve the load promise with another promise
        //                trackLoadResolve(toSpotify.getTracks(trackPageSize, offset));
        //            });
        //        }, Promise.resolve());
        //        // once all have been queued - queue track deletes
        //        return offsets.reduce(function(p) {
        //            return p.then(function() {
        //                return pq.pop();
        //            }).then(function(trackData) {
        //                var trackIds = trackData.items.map(function(item) {
        //                    return item.track.id;
        //                });
        //                return toSpotify.deleteTracks(trackIds);
        //            });
        //        }, Promise.resolve());
        //    }).then(function() {
        //        vm.progressLog += 'Finished wiping tracks\n';
        //    });
        //}
    }
});

function queryStringToObject (qs) {
    return qs.split('&').reduce(function(acc, val) {
        var kv = val.split('=');
        acc[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1]);
        return acc;
    }, {});
}
