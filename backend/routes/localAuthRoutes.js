//localAuthRoutes
import jwt from "jsonwebtoken";
import express from 'express';
import bcrypt from 'bcrypt';
import getUser  from '../models/loginModel.js';
import { inputValidationRegister, inputValidationLogin } from '../auth/error_validation.js';
import { addUser, checkEmail } from "../models/registerModel.js";
import cookieJwtAuth from "../auth/cookieJwtAuth.js";


const router = express.Router();

// Registrar usuario
router.post("/register", async (req, res) => {
    let { email, password, confirm_password } = req.body;

        // Validation
        let errors = inputValidationRegister(email, password, confirm_password);

        // If there are errors, return them
        if (errors.length > 0) {
            res.json({
                errors: errors
            });
        } else {
            // Validation passed
            // Hash password with promises, so it doesn't get stored
            await bcrypt.hash(password, 5, async (err, hash) => {
                if (err) {
                    console.log(err);
                }
                // Se guarda el hash en la base de datos, junto con el username y email
                //console.log(hash);

                // Checar si el email ya está en uso
                const emailExists = await checkEmail(email);
                
                if (emailExists) {
                    res.json({
                        message: "Email already in use"
                    });
                    return "Email already in use";
                } else if (emailExists === null) {
                    res.json({
                        message: "Error checking email"
                    });
                    return;
                }

                // Revisar si el usuario fue añadido
                const userAdded = await addUser(email, hash);
                if (!userAdded) {
                    res.json({
                        message: "Error adding user"
                    });
                    return;
                }
                
                // Creación del Token JWT y de la cookie
                let user = await getUser(email);
                const token = jwt.sign({user_id: user.id, email: user.email, password: user.password}, process.env.JWT_SECRET, {
                    expiresIn: "1h"
                });
                //console.log("Token del login: ", token);
    
                res.cookie("token", token, {
                    httpOnly: false,
                    sameSite: true,
                    //signed: true,
                    secure: true,
                    maxAge: 3600000
                });

                // Si todo sale bien se regresa un mensaje de éxito
                res.json({
                    message: "User registered",
                    isRegistered: true
                });
            });
        }   
});

// Iniciar sesión
router.post("/login", async (req, res) => {
    // Se obtienen los datos del body del request (del payload)
    const { email, password } = req.body;

    // Validation
    let errors = inputValidationLogin(email, password);

    // Si hay errores los regresa
    if (errors.length > 0) {
        res.json({
            errors: errors
        });
    } else {
        // Validation passed
        // Revisar si el usuario existe en la base de datos
        let user = await getUser(email);
        //console.log(user);
        if (!user) {
            res.json({
                message: "User not found"
            });
            return;
        }

        // Se compara el password con el hash de la base de datos
        bcrypt.compare(password, user.password, (err, result) => {
            if (err) {
                console.log(err);
            }

            // Si el resultado es falso, se envía un mensaje de error
            if (!result) {
                res.json({
                    message: "Login failed"
                });
                return;
            } 

            // Creación del Token JWT
            // Si el resultado es verdadero, se firma el token con el secreto
            // El secreto es tu llave privada para la firma digital
            // El token expira en 1 hora
            // SE crea el token con el payload del usuario (que es un objeto con el id, email y password)
            // express-sessions
            const token = jwt.sign({user_id: user.id, email: user.email, password: user.password}, process.env.JWT_SECRET, {
                expiresIn: "1h"
            });
            //console.log("Token del login: ", token);

            // Se crea la cookie en el response header para decirle al browser que la guarde en su cache
            // Esto sirve para que el browser pueda recordar la sesión del usuario y la mande en requests futuros
            // value (lo que sale en la cookie) es el jwt token
            res.cookie("token", token, {
                httpOnly: false,
                sameSite: true,
                //signed: true,
                secure: true,
                maxAge: 3600000
            });

            return res.send({
                message: 'Cookie has been set',
                isLogged: true
            });
        });
    }
});

// Ruta Segura para loggear usuarios con sesión activa
// Básicamente esto nos redirige a la pantalla inicial del chat porque en teoría el token de sesión sigue activo
router.get("/add", cookieJwtAuth, async (req, res) => {
    res.json({isLogged: true});
    //res.redirect(process.env.FRONTEND_URL + "/Profile");
});

// Ruta para el logout
router.get('/logout', (req, res) => {
  res.clearCookie('token'); // Elimina la cookie llamada 'token'

  res.redirect(process.env.FRONTEND_URL + "/login") // Redirige a la página de login
});


export default router;