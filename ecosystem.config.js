module.exports = {
    apps: [
        {
            name: 'parking',
            script: 'bin/www',
        },
        {
            name: 'webhook',
            script: 'bin/webhook',
        },
    ],

    deploy: {
        production: {
            user: 'root',
            host: '45.79.216.182',
            ref: 'origin/master',
            repo: 'https://github.com/Falci/parking.sinpapeles.git',
            path: '/var/www/node/parking',
            'pre-deploy-local': '',
            'post-deploy': 'yarn install && pm2 reload ecosystem.config.js --env production',
            'pre-setup': '',
            env: {
                NODE_ENV: 'production',
            },
        },
    },
};
