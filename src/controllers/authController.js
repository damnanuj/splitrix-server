import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/userModel.js";
import { ENV } from "../utils/env/env.js";
import { OAuth2Client } from "google-auth-library";
import { consoleError } from "../utils/helpers/consoleError.js";

const client = new OAuth2Client(ENV.GOOGLE_WEB_CLIENT_ID);

// --------existing user login------
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(email, password);

    if (!email || !password) {
      return res.status(404).json({
        success: false,
        msg: "Missing credentials",
      });
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        msg: "Invalid email format",
      });
    }

    const user = await User.findOne({ email }).select("+password");
    console.log(user, "sfddffdfdsf");

    if (!user) {
      return res.status(404).json({
        success: false,
        msg: "User not found",
      });
    }
    // ---------password match----
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        msg: "Invalid credentials",
      });
    }
    // ------token generation------
    const token = jwt.sign(
      { id: user._id, email: user.email },
      ENV.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    // console.log(token, user);
    const userObj = user.toObject();
    delete userObj.password;

    return res.status(200).json({
      success: true,
      msg: "Login successful",
      token,
      data: userObj,
    });
  } catch (error) {
    console.error("Login controller error:", error);
    throw new Error("Login failed");
  }
};

// -------old login via google (not used) --------
// export const handleGoogleAuth = async (req, res) => {
//   const { email, name, photo } = req.body;

//   // console.log(email, name, photo, "<<<<<<");

//   try {
//     let user = await User.findOne({ email });
//     // console.log(user, "sfsdf");

//     if (!user) {
//       // ----without password----
//       user = new User({
//         name,
//         email,
//         profilePicture: photo,
//       });
//       await user.save();
//     }

//     const token = jwt.sign(
//       { id: user._id, email: user.email },
//       ENV.JWT_SECRET,
//       { expiresIn: "7d" }
//     );

//     res.status(200).json({
//       success: true,
//       token,
//       data: user,
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ success: false, msg: "Google Auth Failed" });
//   }
// };

// -------new login via google--------

export const handleGoogleAuth = async (req, res) => {
  try {
    const { idToken } = req.body;
    console.log(req.body, "req.body");

    // Validate idToken - check for missing, empty string, or whitespace-only
    if (!idToken || typeof idToken !== "string" || !idToken.trim()) {
      return res.status(400).json({ 
        success: false, 
        msg: "Missing or invalid idToken" 
      });
    }

    // -------verify token with google--------
    const ticket = await client.verifyIdToken({
      idToken: idToken.trim(),
      audience: ENV.GOOGLE_WEB_CLIENT_ID,
    });

    // console.log(ticket, "ticket");

    const payload = ticket.getPayload();

    const { email, name, picture, sub } = payload;

    // -------check or create user--------
    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        name,
        email,
        profilePicture: picture,
        googleId: sub,
      });
    }

    // -------generate jwt--------
    const token = jwt.sign(
      { id: user._id, email: user.email },
      ENV.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      success: true,
      token,
      data: user,
    });
  } catch (error) {
    consoleError(error, "<=======Google login error");
    return res
      .status(401)
      .json({ success: false, msg: "Invalid Google Token" });
  }
};

// ----------new user signup----------
export const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        msg: "All fields are required",
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        msg: "User already exists",
      });
    }
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        msg: "Password must be at least 6 characters long",
      });
    }

    //----------- Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    //---------create & save user
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    //----------JWT token
    const token = jwt.sign(
      { id: newUser._id, email: newUser.email },
      ENV.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(201).json({
      success: true,
      msg: "Signup successful",
      token,
      data: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
      },
    });
  } catch (error) {
    console.error("Error in signup:", error);

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        msg: "Validation failed",
        errors,
      });
    }

    return res.status(500).json({
      success: false,
      msg: "Internal server error",
    });
  }
};

export const demoController = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      msg: "Demo route controller is working",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      msg: "Internal server error",
    });
  }
};
