new Vue({
    el: '#app',
    data: {
        spotifyClientId: 'f6ebcd26b8d948fe908c690e2cc718da',
        fromAuthComplete: false,
        toAuthComplete: false,
        albumCopyPercentage: 80,
        songCopyPercentage: 0,
        progressLog: 'Waiting for authentication'
    },
    methods: {
        authFrom: function() {
            this.fromAuthComplete = true;
        },
        authTo: function() {
            this.toAuthComplete = true;
        }
    }
});
