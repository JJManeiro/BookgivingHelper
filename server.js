const express = require ("express")
const sql = require("sqlite3").verbose();
let query;
const path = require('path');
const server = express();
const port = 3000;
//Abre la final sqlite.
const db = new sql.Database('./editorial.db', sql.OPEN_READWRITE, (error) => {
    if (error){
        console.error(error);
    }
});
//Coge los datos guardados en la carpeta html.
server.use(express.static(path.join(__dirname,'html')));
server.use(express.json()); //Esta linea es necesaria para leer objetos JSON.

server.get('/', (req, res) => {
    res.sendFile(__dirname + '/html/portada.html');
  });
//Muestra todos los datos de la base de datos.
server.get('/data', (req, res) => {
    query = 'select * from Editorial';
    db.all(query,(error, rows) => {
        if (error){
            res.status(500).json({ error: error.message });
            return;
        }
        res.json(rows);
    });
});
//Muestra todos los datos de la base por el mes que le hayas dado.
server.get('/monthly-data', (req, res) => {
    const fecha = req.query.fecha;
    query = 'select * from Editorial where Fecha like ?';
    //El filtro usa un texto formateado para ello. No será el único que veas.
    const filtro = `%${fecha}`;
    db.all(query,filtro,(error, rows) => {
        if (error){
            res.status(500).json({ error: error.message });
            return;
        }
        res.json(rows);
    });
});
//Esta es la ruta de las consultas.
server.get('/query', (req, res) => {
    //Necesitas de un parametro y valor.
    const {parameter, value} = req.query;
    if (!parameter || !value) {
        console.error("Necesito ambos parametro y valor.");
        return res.status(400).json({ error: 'Necesito parametro y valores' });
    }
    //Un array que parsea los que se pueden usar.
    const Permitidos = ['ID', 'Cliente', 'Fecha', 'Libro', 'Curso', 'Cantidad']
    if (!Permitidos.includes(parameter)){
        return res.status(400).json({ error: 'Parámetro no válido.' });
    }
    //Consulta prearada en SQL con textos formateados para dar resultados relativos.
    const query = `SELECT * FROM Editorial WHERE ${parameter} like ?`;
    const queryParams = `%${[value]}%`;

    db.all(query, queryParams, (err, rows) => {
        if (err) {
            console.error(err.message);
            res.status(500).json({ error: 'Fallo de consulta:' });
        } else {
            res.json(rows); // Send query results back as JSON
        }
    });
});
//Esta consulta es mucho mas simple. Pide una ID con el texto formateado.
server.get('/idquery', (req, res) => {
    const value = req.query.value;
    if (!value) {
        return res.status(400).json({ error: 'Pon una ID!' });
    }
    //Este texto formateado en la consulta existe para evitar el siguiente conflicto: Con el guión en el evitas que aparezca ID10,ID100,ID1000[...] cuando quieres sólo la ID1.
    const query = `SELECT * FROM Editorial WHERE ID LIKE ?`;
    const filtro = `%${value}-%`;
    db.all(query, [filtro], (err, results) => {
        if (err) {
            console.error('Fallo de consulta:', err);
            return res.status(500).json({ error: 'Fallo de servidor -' });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'No hay ningún registro parecido.' });
        }
        res.json(results);
    });
});

server.delete('/delete', (req, res) => {
    const id = req.query.id;
    if (!id) {
        return res.status(400).json({ error: 'ID is required for deletion' });
    }
    //Usa la ID dada para borrarla.
    const query = `DELETE FROM Editorial WHERE ID = ?`;

    db.run(query, [id], function(err) {
        if (err) {
            console.error("Error en la base de datos:", err.message);
            res.status(500).json({error: 'Fallo en el eliminado de datos:'});
        //Si no se cambió nada en la base de datos, dirá que no se encontró.
        } else if (this.changes === 0) {
            res.json({ success: false, message: 'No se encontró' });
        } else {
            console.log(`Se borró la ID ${id}.`);
            res.json({ success: true });
        }
    });
});
//Borra todos los datos de la tabla de datos.
server.delete('/delete-all', (req, res) => {
    const query = `DELETE FROM Editorial`;
    db.run(query, function(err) {
        if (err) {
            console.error(":", err.message);
            res.status(500).json({ success: false, error: 'Hay un fallo a revisar' });
        } else {
            console.log("Se borró toda la tabla.");
            res.json({ success: true });
        }
    });
});
//La ruta que actualiza datos.
server.put('/update', (req, res) => {
    //Pide los 3 datos que son ID, Columna y valor nuevo.
    const iden = req.body.iden;
    const columna = req.body.columna;
    const value = req.body.value;
    if (!iden || !columna || !value) {
        return res.status(400).json({ error: 'ID, columna, y valor nuevo son requeridos para actualizar un registro.' });
    }
    //La columna solo puede ser de estos tipos.
    const Columnas = ['ID', 'Cliente', 'Fecha', 'Libro', 'Curso', 'Cantidad'];
    if (!Columnas.includes(columna)) {
        return res.status(400).json({ error: 'Columna inválida.' });
    }
    //Consulta preparada con texto formateado. La Consulta preparada es un array del valor nuevo y viejo de los objetos JSON.
    const query = `UPDATE Editorial SET ${columna} = ? WHERE ID = ?`;
    db.run(query, [value, iden], function(err) {
        if (err) {
            console.error("Error de cambio:", err.message);
            return res.status(500).json({ error: 'Fallo al cambiar de valor:' });
            //Si no cambia nada, te dirá que no se encontróel resultado.
        } else if (this.changes === 0) {
            return res.json({ success: false, message: 'Registro no encontrado' });
        } else {
            console.log(`La ID ${iden} cambio con éxito.`);
            return res.json({ success: true });
        }
    });
});
//La ruta que crea los registros de pedidos.
server.post('/create', (req, res) => {
    const { ID, Cliente, Fecha, Libro, Curso, Cantidad } = req.body;
    //Consulta preparada con varios parámetros que son puestos en un array tras haber sido pasados de objeto JSON a String.
    const query = `INSERT INTO Editorial (ID, Cliente, Fecha, Libro, Curso, Cantidad) VALUES (?, ?, ?, ?, ?, ?)`;
    db.run(query, [ID, Cliente, Fecha, Libro, Curso, Cantidad], function(err) {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ message: 'Fallo al crear:' });
        }
        res.status(200).json({ message: 'fue un éxito!', id: this.lastID });
    });
});
//Las rutas de las tartas en pdf. Todas son un calco con query distinto así solo comentaré esta.
server.get('/piechart', (req, res) => {
    const fecha = req.query.fecha;
    //Consulta preparada donde pide el mes y año.
    const query = `SELECT Curso, SUM(Cantidad) as count FROM Editorial WHERE Fecha like ? GROUP BY Curso`;
    const filtro = `%${fecha}`;
    db.all(query, filtro, (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: 'Fallo:' });
        }
        //Señala el sumatorio de datos en la tarta.
        const result = rows.reduce((acc, row) => {
            acc[row.Curso] = row.count;
            return acc;
        }, {});
        res.json(result);
    });
});

server.get('/pictos', (req, res) => {
    const fecha = req.query.fecha;
    const query = `SELECT Libro, SUM(Cantidad) as count FROM Editorial where Fecha like ? and Curso = 'Ed. con Pictos' GROUP BY Libro`;
    const filtro = `%${fecha}`;
    db.all(query, filtro, (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: 'Database error' });
        }

        const result = rows.reduce((acc, row) => {
            acc[row.Libro] = row.count;
            return acc;
        }, {});

        res.json(result);
    });
});
server.get('/basica', (req, res) => {
    const fecha = req.query.fecha;
    const query = `SELECT Libro, SUM(Cantidad) as count FROM Editorial where Fecha like ? and Curso = 'Ed. Basica' GROUP BY Libro`;
    const filtro = `%${fecha}`;
    db.all(query, filtro, (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: 'Database error' });
        }

        const result = rows.reduce((acc, row) => {
            acc[row.Libro] = row.count;
            return acc;
        }, {});

        res.json(result);
    });
});
server.get('/primaria', (req, res) => {
    const fecha = req.query.fecha;
    const query = `SELECT Libro, SUM(Cantidad) as count FROM Editorial where Fecha like ? and Curso = 'Ed. Primaria' GROUP BY Libro`;
    const filtro = `%${fecha}`;
    db.all(query, filtro, (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: 'Database error' });
        }

        const result = rows.reduce((acc, row) => {
            acc[row.Libro] = row.count;
            return acc;
        }, {});

        res.json(result);
    });
});
server.get('/permanente', (req, res) => {
    const fecha = req.query.fecha;
    const query = `SELECT Libro, SUM(Cantidad) as count FROM Editorial where Fecha like ? and Curso = 'Ed. Permanente' GROUP BY Libro`;
    const filtro = `%${fecha}`;
    db.all(query, filtro, (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: 'Database error' });
        }

        const result = rows.reduce((acc, row) => {
            acc[row.Libro] = row.count;
            return acc;
        }, {});

        res.json(result);
    });
});
server.get('/excepcional', (req, res) => {
    const fecha = req.query.fecha;
    const query = `SELECT Libro, SUM(Cantidad) as count FROM Editorial where Fecha like ? and Curso = 'Sec. Excepcional' GROUP BY Libro`;
    const filtro = `%${fecha}`;
    db.all(query, filtro, (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: 'Database error' });
        }

        const result = rows.reduce((acc, row) => {
            acc[row.Libro] = row.count;
            return acc;
        }, {});

        res.json(result);
    });
});
server.get('/1ESO', (req, res) => {
    const fecha = req.query.fecha;
    const query = `SELECT Libro, SUM(Cantidad) as count FROM Editorial where Fecha like ? and Curso = 'Ed. 1ESO' GROUP BY Libro`;
    const filtro = `%${fecha}`;
    db.all(query, filtro, (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: 'Database error' });
        }

        const result = rows.reduce((acc, row) => {
            acc[row.Libro] = row.count;
            return acc;
        }, {});

        res.json(result);
    });
});
server.get('/2ESO', (req, res) => {
    const fecha = req.query.fecha;
    const query = `SELECT Libro, SUM(Cantidad) as count FROM Editorial where Fecha like ? and Curso = 'Ed. 2ESO' GROUP BY Libro`;
    const filtro = `%${fecha}`;
    db.all(query, filtro, (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: 'Database error' });
        }

        const result = rows.reduce((acc, row) => {
            acc[row.Libro] = row.count;
            return acc;
        }, {});

        res.json(result);
    });
});
server.get('/3ESO', (req, res) => {
    const fecha = req.query.fecha;
    const query = `SELECT Libro, SUM(Cantidad) as count FROM Editorial where Fecha like ? and Curso = 'Ed. 3ESO' GROUP BY Libro`;
    const filtro = `%${fecha}`;
    db.all(query, filtro, (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: 'Database error' });
        }

        const result = rows.reduce((acc, row) => {
            acc[row.Libro] = row.count;
            return acc;
        }, {});

        res.json(result);
    });
});
//Se pone a monitorizar el puerto asignado, en este caso es el 3000.
server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});