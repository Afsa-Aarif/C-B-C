
import mongoose from "mongoose";

const membershipRequestSchema = new mongoose.Schema(
    {
        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        requestedTier: {
            type: String,
            enum: ["Premium", "VIP"],
            required: true,
        },

        status: {
            type: String,
            enum: ["Pending", "Approved", "Rejected"],
            default: "Pending",
        },

        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        reviewedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

// Prevent a customer from having multiple pending requests
membershipRequestSchema.index(
    { customer: 1 },
    {
        unique: true,
        partialFilterExpression: { status: "Pending" },
    }
);

const MembershipRequest = mongoose.model(
    "MembershipRequest",
    membershipRequestSchema
);

export default MembershipRequest;
