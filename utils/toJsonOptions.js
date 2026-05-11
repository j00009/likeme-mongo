const toJsonOptions = {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        const id = ret._id || ret.id;

        if (id) {
            ret.id = id.toString();
        }

        delete ret._id;
        return ret;
    }
};

module.exports = toJsonOptions;
