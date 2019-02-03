var spotifyEndpoint = 'https://api.spotify.com/v1';

function Spotify(clientId, rateLimitLock) {
    this.clientId = clientId;
    this.ax = null;

    this.startAuth = function(options) {
        var qs = objectToQueryString({
            client_id: this.clientId,
            scope: options.scope,
            state: options.state,
            show_dialog: 'true',
            response_type: 'token',
            redirect_uri: window.location.href.split('#')[0]
        });
        var newURI = 'https://accounts.spotify.com/authorize/?' + qs;
        window.location.replace(newURI);
    }

    this.finishAuth = function(token) {
        this.ax = axios.create({
            baseURL: spotifyEndpoint,
            headers: { Authorization: 'Bearer ' + token }
        });
    }

    this.makeRequest = function(requestLambda) {
        var spi = this;
        // make sure we wait for the rate limit lock (null if not limited)
        return Promise.resolve(rateLimitLock)
            .then(function() {
                // execute request and wait for response
                return requestLambda();
            }).then(function(response) {
                return response.data;
            }).catch(function(error) {
                if (error.response && error.response.status === 429) {
                    // if we're the first to get a 429 set rateLimitLock
                    if (rateLimitLock === null) {
                        var retryAfter = parseInt(error.response.headers['retry-after']);
                        rateLimitLock = new Promise(function(resolve, reject) {
                            console.log('Spotify waiting for ' + retryAfter + ' s');
                            setTimeout(function() {
                                rateLimitLock = null;
                                resolve();
                            }, retryAfter * 1000);
                        });
                    }
                    // retry after waiting
                    return rateLimitLock.then(spi.makeRequest.bind(spi, requestLambda));
                } else if (error.response && error.response.status === 401) {
                    console.log('auth token has expired');
                } else if (error.response && error.response.status === 403) {
                    console.log('request not authorized (hint: scope)');
                } else if (error.response) {
                    console.log('response received, error unknown');
                    console.log(response);
                } else if (error.request) {
                    // did not get a response from the server - retry now
                    console.log('retrying request');
                    return spi.makeRequest(requestLambda);
                } else {
                    console.log(error);
                }
            });
    }

    this.getMe = function() {
        var sp = this;
        return this.makeRequest(function() {
            return sp.ax.get('/me');
        });
    }

    this.getAlbums = function(limit, offset) {
        var sp = this;
        return this.makeRequest(function() {
            return sp.ax.get('/me/albums', {
                params: { limit: limit, offset: offset }
            });
        });
    }

    this.saveAlbums = function(albumIds) {
        var sp = this;
        return this.makeRequest(function() {
            return sp.ax.put('/me/albums', albumIds);
        });
    }

    this.getTracks = function(limit, offset) {
        var sp = this;
        return this.makeRequest(function() {
            return sp.ax.get('/me/tracks', {
                params: { limit: limit, offset: offset }
            });
        });
    }

    this.saveTracks = function(trackIds) {
        var sp = this;
        return this.makeRequest(function() {
            return sp.ax.put('/me/tracks', trackIds);
        });
    }
}

function objectToQueryString (o) {
    var qs = Object
        .keys(o)
        .map(function(k) {
            return encodeURIComponent(k) + '=' + encodeURIComponent(o[k]);
        })
        .join('&');
    return qs;
}
