var express  = require('express'),
    path     = require('path'),
    bodyParser = require('body-parser'),
    app = express();
var config = require('./database');

app.use(bodyParser.json());

// Conexion a MySql.
var connection  = require('express-myconnection'),
    mysql = require('mysql');

app.use(
    connection(mysql, {
        host     : config.database.HOST,
        user     : config.database.USERNAME,
        password : config.database.PASSWORD,
        database : config.database.DATABASE,
        debug    : false    // Si es true es para el debug.
    }, 'request')
);

// RESTful route.
var v1 = express.Router();

v1.get('/', function(req, res){
    res.send('API Paraguay - GIS');
});

// Funcion para obtener la IP.
function getIP(req) {
    var ip = req.headers['x-forwarded-for'] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.connection.socket.remoteAddress;
    ip = ip.split(',')[0];
    ip = ip.split(':').slice(-1); // En caso que la IP retorne en el formato: "::ffff:146.xxx.xxx.xxx"
    return ip;
}

/*------------------------------------------------------
*  This is router middleware,invoked everytime
*  we hit url /api and anything after /api
*  like /api/user , /api/user/7
*  we can use this for doing validation,authetication
*  for every route started with /api
--------------------------------------------------------*/
v1.use(function(req, res, next) {
    var ip = getIP(req);
    console.log("Cliente IP es: " + ip);
    console.log(req.method, req.url);
    next();
});

var curut = v1.route('/departamentos');


//show the CRUD interface | GET
// Ejemplo: http://localhost:3000/api/v1/departamentos
curut.get(function(req, res, next){
    req.getConnection(function(err,conn){
        if (err){
            return next("No se puede conectar a la base de datos.");
        }
        var query = conn.query('SELECT departamento_id, departamento_nombre, departamento_capital FROM departamentos', function(err, rows){
            if(err){
                console.log(err);
                return next("Error Mysql, check la consulta.");
            }
            res.json(rows);
         });
    });
});

//now for Single route (GET)
var curut2 = v1.route('/departamentos/:log/:lat');

/*------------------------------------------------------
route.all is extremely useful. you can use it to do
stuffs for specific routes. for example you need to do
a validation everytime route /api//departamentos/:log/:lat it hit.

------------------------------------------------------*/
curut2.all(function(req, res, next){
    console.log(req.params);
    next();
});

//get data to update
// Ejemplo1: http://localhost:3000/api/v1/departamentos/-56.987/-25.564
// Ejemplo2: http://localhost:3000/api/v1/departamentos/-59.517228974/-23.8302210107
curut2.get(function(req, res, next){
    var log = req.params.log;
    var lat = req.params.lat;

    req.getConnection(function(err, conn){
        if (err){
            return next("No se puede conectar a la base de datos.");
        }
        var query = conn.query(
          'SELECT dep.departamento_nombre, dep.departamento_capital, dis.distrito_nombre, ciu.ciudad_nombre ' +
          '  FROM departamentos dep LEFT JOIN distritos dis ' +
          '  ON ST_Contains(dis.geom, ST_GeomFromText("POINT(' + log + ' ' + lat + ')",1))' +
          '  LEFT JOIN ciudades ciu ON ST_Contains(ciu.geom, ST_GeomFromText("POINT(' + log + ' ' + lat + ')",1))' +
          '  WHERE ST_Contains(dep.geom, ST_GeomFromText("POINT(' + log + ' ' + lat + ')",1)) AND ST_Contains(ciu.geom, ST_GeomFromText("POINT(' + log + ' ' + lat + ')",1))', function(err, rows){
            if(err){
                console.log(err);
                return next("Error Mysql, verificar la consulta.");
            }

            // if departamento no encontrado.
            if(rows.length < 1){
                return res.send("Departamento no encontrado!!!");
            }
            res.json(rows);
        });
    });
});

// Route principal:
// - /api/v1
app.use('/api/v1', v1);

// Start Server.
var server = app.listen(3000, function () {
    var host = server.address().address;
    host = (host === '::' ? 'localhost' : host);
    var port = server.address().port;
    console.log("Server: ", server.address());
    console.log('Escucha http://%s:%s', host, port);
});
