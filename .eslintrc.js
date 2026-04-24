'use strict'

module.exports = {
    env: {
        node: true,
        es2020: true
    },
    extends: ['standard'],
    rules: {
        'no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    },
    overrides: [
        {
            // Browser-side resources: allow window/document globals and RED
            files: ['resources/**/*.js'],
            env: {
                browser: true,
                node: false
            },
            globals: {
                RED: 'readonly'
            }
        },
        {
            files: ['test/**/*.spec.js'],
            env: {
                node: true,
                mocha: true
            }
        }
    ]
}
