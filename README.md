## Deploying to Heroku
```
$ heroku create

$ heroku open
```

## Run the app locally
heroku local web

## View logs
heroku logs --tail

## Define config vars
heroku config:set TIMES=2
heroku config

## Scale the app
heroku ps
heroku ps:scale web=1

## Push local changes
git push heroku master

## Documentation

For more information about using Node.js on Heroku, see these Dev Center articles:

- [Getting Started with Node.js on Heroku](https://devcenter.heroku.com/articles/getting-started-with-nodejs)
- [Heroku Node.js Support](https://devcenter.heroku.com/articles/nodejs-support)
- [Node.js on Heroku](https://devcenter.heroku.com/categories/nodejs)
- [Best Practices for Node.js Development](https://devcenter.heroku.com/articles/node-best-practices)
- [Using WebSockets on Heroku with Node.js](https://devcenter.heroku.com/articles/node-websockets)
