function transform(input) {
    return {
        ...input,
        data: input.data?.map(a => {
            delete a.author_bio;
            delete a.custom_fields;
            return a;
        })
    };
}