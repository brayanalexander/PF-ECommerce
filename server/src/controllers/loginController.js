const bcrypt = require("bcrypt");
const HttpError = require("../errors/http-error");
const { thereIsEmail } = require("../util/helpers/db-validators");
const { validationResult } = require("express-validator");
const { generateToken } = require("../util/helpers/jwt-generator");
const models = require("../db");
const { User } = require("../db");
const jwt_decode = require("jwt-decode");

const loginController = {
  registerUser: async (req, res, next) => {
    //verifico los campos del req
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json(errors);
    }
    // tomo los datos desde el body
    let name = req.body.name;
    let isActive = req.body.isActive;
    let email = req.body.email;
    let role = req.body.role;
    let lastName = req.body.lastName;
    let password = bcrypt.hashSync(req.body.password, 10);
    let picture = req.body.picture;
    //compruebo si el email ya existe
    try {
      const user = await thereIsEmail(email);
      //console.log(user);

      if (user) {
        return res.status(400).json({
          status: 0,
          messsage: "User already exists",
        });
      }
      if (!user) {
        //creo el usuario
        const userCreated = await User.create({
          name,
          isActive,
          lastName,
          password,
          email,
          role,
          picture,
        });

        const data = {
          name: userCreated._previousDataValues.name,
          lastName: userCreated._previousDataValues.lastName,
          email: userCreated._previousDataValues.email,
          role: userCreated._previousDataValues.role,
          isActive: userCreated._previousDataValues.isActive,
          isGoogle: false,
          picture: userCreated._previousDataValues.picture,
          //token: token
        };

        return res.status(200).json({
          status: 1,
          msg: "User registered successfully",
          data: data,
        });
      }
    } catch (error) {
      console.log(error);
    }
  },
  loginUser: async (req, res, next) => {
    const errors = validationResult(req);
    //console.log(res.headers);
    if (!errors.isEmpty()) {
      return res.status(400).json(errors);
    }
    // por body el mail
    try {
      // funcion validadora de email
      const user = await thereIsEmail(req.body.email);

      if (user) {
        if (bcrypt.compareSync(req.body.password, user.password)) {
          const token = await generateToken(user.id, user.name);

          const resp = {
            name: user.name,
            lastName: user.lastName,
            role: user.role,
            isActive: user.isActive,
            email: user.email,
            isGoogle: user.isGoogle,
            picture: user.picture,
            iduser:user.id
          };
          return res.status(200).json({
            status: 1,
            messsage: "User logged in successfully",
            user: resp,
            role: user.role,
            token: token,
          });
        } else {
          return res.status(500).json({
            status: 0,
            messsage: "User do not match",
          });
        }
      } else {
        res.status(500).json({
          status: 0,
          messsage: "User do not exists whidth email address ",
        });
      }
    } catch (error) {
      console.log(error);
    }
  },
  deleteUser: async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json(errors);
    }
    const { id } = req.params; // saco el id
    const modification = req.body;
    //console.log(modification);
    const user = await models.User.update(modification, {
      where: {
        id: id,
      },
    });
    res.json(user);
  },
  putUser: async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json(errors);
    }

    const { id } = req.params; // saco el id
    const modification = req.body; // los cambios que voy a realizar
    const user = await thereIsEmail(req.body.email);

    const change = await models.User.update(modification, {
      where: {
        id: id,
      },
    });

    const data = await models.User.findByPk(id);
    return res.json({
      mesg: "User updated",
      data: data,
    });
  },
  getAllUsers: async (req, res, next) => {
    const p1 = models.User.findAndCountAll({ where: { isActive: true } });
    const p2 = models.User.findAndCountAll({ where: { isActive: false } });
    const p3 = models.User.count();

    const [activeUser, inactiveUsers, quantity] = await Promise.all([
      p1,
      p2,
      p3,
    ]);

    res.json({
      totalRegisters: quantity,
      activeRegData: activeUser.rows,
      activeRegQuantity: activeUser.count,
      inactiveRegData: inactiveUsers.rows,
      inactiveQuantity: inactiveUsers.count,
    });
  },
  tokenRevalidate: async (req, res, next) => {
    const id = req.id;
    const name = req.name;
    const token = await generateToken(id, name);
    res.status(200).json({
      status: true,
      id,
      name,
      token,
    });
  },

  googleSignIn: async (req, res, next) => {
    const { credential } = req.body;

    const googleUser = jwt_decode(credential);

    try {
      // me pregunto si email por token existe en mi base de datos

      const user = await thereIsEmail(googleUser.email);

      // console.log(googleUser);

      if (!user) {
        const data = {
          isGoogle: true,
          isActive: true,
          name: googleUser.given_name,
          lastName: googleUser.family_name, // nodemailer
          //   password: "::P)",
          password: "1234hola",
          role: "USER",
          email: googleUser.email,
          picture: googleUser.picture,
        };

        // console.log("Data: ", data);

        const userCreated = await models.User.create({
          name: data.name,
          isActive: true,
          isGoogle: data.isGoogle,
          lastName: data.lastName,
          password: data.password,
          email: data.email,
          role: data.role,
          picture: data.picture,
        });
        const { name, lastName, role, isActive, email, isGoogle, picture } =
          userCreated;

        const resp = {
          name,
          lastName,
          role,
          isActive,
          isGoogle,
          email,
          picture,
          iduser:userCreated.id
        };

        return res.status(200).json({
          status: 1,
          message: "User has been created with successfull",
          user: resp,
        });
      }

      // busco si esta bloqueado

      if (!user.isActive) {
        return res.status(401).json({
          status: 0,
          message: "Unauthorized user",
        });
      }

      //genero el json web token

      const token = await generateToken(user.id, user.name);

      const { name, lastName, role, isActive, email, isGoogle, picture } = user;
      const resp2 = {
        name,
        lastName,
        role,
        isActive,
        email,
        isGoogle,
        picture,
        iduser:user.id
      };

      res.status(200).json({
        status: 1,
        message: "User created with google",
        user: resp2,
        token: token,
      });
    } catch (error) {
      //console.log(error);
      res.status(500).json({
        status: 0,
        message: "Ivalid token",
      });
    }
  },

  getFavorites: async (req, res, next) => {
    const { id } = req.params;
    try {
      if (!id) throw new HttpError("Debe enviar el id del usuario", 400);
      const userfind = models.User.findByPk({
        where: {
          id,
          isActive: true,
        },
        include: [
          {
            model: Books,
            as: "favorites",
            through: { 
              attributes: [],
            },
          },
        ],
      });
      if (!userfind) throw new HttpError("Usuario no logeado", 404);
      res.json(userfind);
    } catch (error) {
      if (!(error instanceof HttpError)) {
        error = new HttpError("Error interno del servidor", 500);
      }
      return next(error);
    }
  },
};

module.exports = loginController;
