import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        // FIX: Use findById instead of findOne
        const user = await User.findById(userId)

        if (!user) {
            throw new ApiError(404, "User not found for token generation")
        }

        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken;

        // validateBeforeSave: false is correct here to bypass password validation
        await user.save({ validateBeforeSave: false })

        return { accessToken, refreshToken }

    } catch (error) {
        // Logging the actual error helps you debug faster in the future
        console.error("Token Generation Error:", error);
        throw new ApiError(500, "Something went wrong while generating refresh and access token")
    }
}

const registerUser = asyncHandler(async (req, res) => {
    //get user details from frontend
    //validation - not empty
    //check if user already exists: username, email
    //check for images, check for avatar
    //upload them to cloudinary, avatar
    // create user object - create entry in db
    //remove password and refresh token field from response
    //check for user creation
    //return response

    const { fullName, email, username, password } = req.body
    console.log("email", email);

    // if (fullName === "") {
    //     throw new ApiError(400, "fullname is required");
    // }

    if (
        [fullName, email, username, password].some((field) =>
            field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "Username already exist")
    }

    // console.log("REQ.FILES 👉", req.files);

    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage?.[0]?.path?.replace(/\\/g, "/");

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }



    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!avatar) {
        throw new ApiError(400, "Avatar upload failed");
    }

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered succefully")
    )
})

const loginUser = asyncHandler(async (req, res) => {
    // 1. Get data from body
    const { email, username, password } = req.body;

    // 2. Validation - Check if password exists along with email/username
    if (!password) {
        throw new ApiError(400, "Password is required");
    }

    if (!username && !email) {
        throw new ApiError(400, "Username or email is required");
    }

    // 3. Find the user
    const user = await User.findOne({
        $or: [{ username }, { email }]
    }).select("+password"); // Ensures password is included if hidden in schema

    if (!user) {
        throw new ApiError(404, "User does not exist");
    }

    // 4. Check Password
    // Check your console logs: if password is still undefined here, 
    // check your Postman/Frontend body key names!
    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credentials");
    }

    // 5. Generate Tokens
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

    // 6. Get clean user object (without sensitive info)
    const loggedInUser = await User.findById(user._id).select("-password -refreshTokens");

    const options = {
        httpOnly: true,
        secure: true
    };

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser, accessToken, refreshToken
                },
                "User logged In Successfully"
            )
        );
});

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )
    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200), {}, "User Loged out")

})

const refreshAccessToken = asyncHandler(async (req, res) => {

    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new ApiError(401, "unautorized request")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = await User.findById(decodedToken?._id)
    
        if (!user) {
            throw new ApiError(401, "invalid refresh token")
        }
    
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "refresh token is expired or use")
        }
    
        const options = {
            httpOnly:true,
            secure:true
        }
    
       const {accessToken,newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
    
       return res
       .status(200)
       .cookie("accessToken",accessToken,options)
       .cookie("refreshToken",newRefreshToken,options)
       .json(
        new ApiResponse(
            200,
            {accessToken,refreshToken:newRefreshToken},
            "Access token refreshed"
        )
       )
    } catch (error) {
        throw new ApiError(401,error?.message || "Invalid refresh token")
    }
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken
};