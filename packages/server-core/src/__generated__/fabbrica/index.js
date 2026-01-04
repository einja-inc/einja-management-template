import { createInitializer, createScreener, getScalarFieldValueGenerator, normalizeResolver, normalizeList, getSequenceCounter, createCallbackChain, destructure } from "@quramy/prisma-fabbrica/lib/internal";
export { resetSequence, registerScalarFieldValueGenerator, resetScalarFieldValueGenerator } from "@quramy/prisma-fabbrica/lib/internal";
const initializer = createInitializer();
const { getClient } = initializer;
export const { initialize } = initializer;
const modelFieldDefinitions = [{
        name: "User",
        fields: [{
                name: "accounts",
                type: "Account",
                relationName: "AccountToUser"
            }, {
                name: "sessions",
                type: "Session",
                relationName: "SessionToUser"
            }, {
                name: "Authenticator",
                type: "Authenticator",
                relationName: "AuthenticatorToUser"
            }]
    }, {
        name: "Account",
        fields: [{
                name: "user",
                type: "User",
                relationName: "AccountToUser"
            }]
    }, {
        name: "Session",
        fields: [{
                name: "user",
                type: "User",
                relationName: "SessionToUser"
            }]
    }, {
        name: "VerificationToken",
        fields: []
    }, {
        name: "Authenticator",
        fields: [{
                name: "user",
                type: "User",
                relationName: "AuthenticatorToUser"
            }]
    }];
function autoGenerateUserScalarsOrEnums({ seq }) {
    return {
        email: getScalarFieldValueGenerator().String({ modelName: "User", fieldName: "email", isId: false, isUnique: true, seq })
    };
}
function defineUserFactoryInternal({ defaultData: defaultDataResolver, onAfterBuild, onBeforeCreate, onAfterCreate, traits: traitsDefs = {} }, defaultTransientFieldValues) {
    const getFactoryWithTraits = (traitKeys = []) => {
        const seqKey = {};
        const getSeq = () => getSequenceCounter(seqKey);
        const screen = createScreener("User", modelFieldDefinitions);
        const handleAfterBuild = createCallbackChain([
            onAfterBuild,
            ...traitKeys.map(traitKey => { var _a; return (_a = traitsDefs[traitKey]) === null || _a === void 0 ? void 0 : _a.onAfterBuild; }),
        ]);
        const handleBeforeCreate = createCallbackChain([
            ...traitKeys.slice().reverse().map(traitKey => { var _a; return (_a = traitsDefs[traitKey]) === null || _a === void 0 ? void 0 : _a.onBeforeCreate; }),
            onBeforeCreate,
        ]);
        const handleAfterCreate = createCallbackChain([
            onAfterCreate,
            ...traitKeys.map(traitKey => { var _a; return (_a = traitsDefs[traitKey]) === null || _a === void 0 ? void 0 : _a.onAfterCreate; }),
        ]);
        const build = async (inputData = {}) => {
            const seq = getSeq();
            const requiredScalarData = autoGenerateUserScalarsOrEnums({ seq });
            const resolveValue = normalizeResolver(defaultDataResolver !== null && defaultDataResolver !== void 0 ? defaultDataResolver : {});
            const [transientFields, filteredInputData] = destructure(defaultTransientFieldValues, inputData);
            const resolverInput = Object.assign({ seq }, transientFields);
            const defaultData = await traitKeys.reduce(async (queue, traitKey) => {
                var _a, _b;
                const acc = await queue;
                const resolveTraitValue = normalizeResolver((_b = (_a = traitsDefs[traitKey]) === null || _a === void 0 ? void 0 : _a.data) !== null && _b !== void 0 ? _b : {});
                const traitData = await resolveTraitValue(resolverInput);
                return Object.assign(Object.assign({}, acc), traitData);
            }, resolveValue(resolverInput));
            const defaultAssociations = {};
            const data = Object.assign(Object.assign(Object.assign(Object.assign({}, requiredScalarData), defaultData), defaultAssociations), filteredInputData);
            await handleAfterBuild(data, transientFields);
            return data;
        };
        const buildList = (...args) => Promise.all(normalizeList(...args).map(data => build(data)));
        const pickForConnect = (inputData) => ({
            id: inputData.id
        });
        const create = async (inputData = {}) => {
            const data = await build(Object.assign({}, inputData)).then(screen);
            const [transientFields] = destructure(defaultTransientFieldValues, inputData);
            await handleBeforeCreate(data, transientFields);
            const createdData = await getClient().user.create({ data });
            await handleAfterCreate(createdData, transientFields);
            return createdData;
        };
        const createList = (...args) => Promise.all(normalizeList(...args).map(data => create(data)));
        const createForConnect = (inputData = {}) => create(inputData).then(pickForConnect);
        return {
            _factoryFor: "User",
            build,
            buildList,
            buildCreateInput: build,
            pickForConnect,
            create,
            createList,
            createForConnect,
        };
    };
    const factory = getFactoryWithTraits();
    const useTraits = (name, ...names) => {
        return getFactoryWithTraits([name, ...names]);
    };
    return Object.assign(Object.assign({}, factory), { use: useTraits });
}
/**
 * Define factory for {@link User} model.
 *
 * @param options
 * @returns factory {@link UserFactoryInterface}
 */
export const defineUserFactory = ((options) => {
    return defineUserFactoryInternal(options !== null && options !== void 0 ? options : {}, {});
});
defineUserFactory.withTransientFields = defaultTransientFieldValues => options => defineUserFactoryInternal(options !== null && options !== void 0 ? options : {}, defaultTransientFieldValues);
function isAccountuserFactory(x) {
    return (x === null || x === void 0 ? void 0 : x._factoryFor) === "User";
}
function autoGenerateAccountScalarsOrEnums({ seq }) {
    return {
        type: getScalarFieldValueGenerator().String({ modelName: "Account", fieldName: "type", isId: false, isUnique: false, seq }),
        provider: getScalarFieldValueGenerator().String({ modelName: "Account", fieldName: "provider", isId: true, isUnique: false, seq }),
        providerAccountId: getScalarFieldValueGenerator().String({ modelName: "Account", fieldName: "providerAccountId", isId: true, isUnique: false, seq })
    };
}
function defineAccountFactoryInternal({ defaultData: defaultDataResolver, onAfterBuild, onBeforeCreate, onAfterCreate, traits: traitsDefs = {} }, defaultTransientFieldValues) {
    const getFactoryWithTraits = (traitKeys = []) => {
        const seqKey = {};
        const getSeq = () => getSequenceCounter(seqKey);
        const screen = createScreener("Account", modelFieldDefinitions);
        const handleAfterBuild = createCallbackChain([
            onAfterBuild,
            ...traitKeys.map(traitKey => { var _a; return (_a = traitsDefs[traitKey]) === null || _a === void 0 ? void 0 : _a.onAfterBuild; }),
        ]);
        const handleBeforeCreate = createCallbackChain([
            ...traitKeys.slice().reverse().map(traitKey => { var _a; return (_a = traitsDefs[traitKey]) === null || _a === void 0 ? void 0 : _a.onBeforeCreate; }),
            onBeforeCreate,
        ]);
        const handleAfterCreate = createCallbackChain([
            onAfterCreate,
            ...traitKeys.map(traitKey => { var _a; return (_a = traitsDefs[traitKey]) === null || _a === void 0 ? void 0 : _a.onAfterCreate; }),
        ]);
        const build = async (inputData = {}) => {
            const seq = getSeq();
            const requiredScalarData = autoGenerateAccountScalarsOrEnums({ seq });
            const resolveValue = normalizeResolver(defaultDataResolver);
            const [transientFields, filteredInputData] = destructure(defaultTransientFieldValues, inputData);
            const resolverInput = Object.assign({ seq }, transientFields);
            const defaultData = await traitKeys.reduce(async (queue, traitKey) => {
                var _a, _b;
                const acc = await queue;
                const resolveTraitValue = normalizeResolver((_b = (_a = traitsDefs[traitKey]) === null || _a === void 0 ? void 0 : _a.data) !== null && _b !== void 0 ? _b : {});
                const traitData = await resolveTraitValue(resolverInput);
                return Object.assign(Object.assign({}, acc), traitData);
            }, resolveValue(resolverInput));
            const defaultAssociations = {
                user: isAccountuserFactory(defaultData.user) ? {
                    create: await defaultData.user.build()
                } : defaultData.user
            };
            const data = Object.assign(Object.assign(Object.assign(Object.assign({}, requiredScalarData), defaultData), defaultAssociations), filteredInputData);
            await handleAfterBuild(data, transientFields);
            return data;
        };
        const buildList = (...args) => Promise.all(normalizeList(...args).map(data => build(data)));
        const pickForConnect = (inputData) => ({
            provider: inputData.provider,
            providerAccountId: inputData.providerAccountId
        });
        const create = async (inputData = {}) => {
            const data = await build(Object.assign({}, inputData)).then(screen);
            const [transientFields] = destructure(defaultTransientFieldValues, inputData);
            await handleBeforeCreate(data, transientFields);
            const createdData = await getClient().account.create({ data });
            await handleAfterCreate(createdData, transientFields);
            return createdData;
        };
        const createList = (...args) => Promise.all(normalizeList(...args).map(data => create(data)));
        const createForConnect = (inputData = {}) => create(inputData).then(pickForConnect);
        return {
            _factoryFor: "Account",
            build,
            buildList,
            buildCreateInput: build,
            pickForConnect,
            create,
            createList,
            createForConnect,
        };
    };
    const factory = getFactoryWithTraits();
    const useTraits = (name, ...names) => {
        return getFactoryWithTraits([name, ...names]);
    };
    return Object.assign(Object.assign({}, factory), { use: useTraits });
}
/**
 * Define factory for {@link Account} model.
 *
 * @param options
 * @returns factory {@link AccountFactoryInterface}
 */
export const defineAccountFactory = ((options) => {
    return defineAccountFactoryInternal(options, {});
});
defineAccountFactory.withTransientFields = defaultTransientFieldValues => options => defineAccountFactoryInternal(options, defaultTransientFieldValues);
function isSessionuserFactory(x) {
    return (x === null || x === void 0 ? void 0 : x._factoryFor) === "User";
}
function autoGenerateSessionScalarsOrEnums({ seq }) {
    return {
        sessionToken: getScalarFieldValueGenerator().String({ modelName: "Session", fieldName: "sessionToken", isId: false, isUnique: true, seq }),
        expires: getScalarFieldValueGenerator().DateTime({ modelName: "Session", fieldName: "expires", isId: false, isUnique: false, seq })
    };
}
function defineSessionFactoryInternal({ defaultData: defaultDataResolver, onAfterBuild, onBeforeCreate, onAfterCreate, traits: traitsDefs = {} }, defaultTransientFieldValues) {
    const getFactoryWithTraits = (traitKeys = []) => {
        const seqKey = {};
        const getSeq = () => getSequenceCounter(seqKey);
        const screen = createScreener("Session", modelFieldDefinitions);
        const handleAfterBuild = createCallbackChain([
            onAfterBuild,
            ...traitKeys.map(traitKey => { var _a; return (_a = traitsDefs[traitKey]) === null || _a === void 0 ? void 0 : _a.onAfterBuild; }),
        ]);
        const handleBeforeCreate = createCallbackChain([
            ...traitKeys.slice().reverse().map(traitKey => { var _a; return (_a = traitsDefs[traitKey]) === null || _a === void 0 ? void 0 : _a.onBeforeCreate; }),
            onBeforeCreate,
        ]);
        const handleAfterCreate = createCallbackChain([
            onAfterCreate,
            ...traitKeys.map(traitKey => { var _a; return (_a = traitsDefs[traitKey]) === null || _a === void 0 ? void 0 : _a.onAfterCreate; }),
        ]);
        const build = async (inputData = {}) => {
            const seq = getSeq();
            const requiredScalarData = autoGenerateSessionScalarsOrEnums({ seq });
            const resolveValue = normalizeResolver(defaultDataResolver);
            const [transientFields, filteredInputData] = destructure(defaultTransientFieldValues, inputData);
            const resolverInput = Object.assign({ seq }, transientFields);
            const defaultData = await traitKeys.reduce(async (queue, traitKey) => {
                var _a, _b;
                const acc = await queue;
                const resolveTraitValue = normalizeResolver((_b = (_a = traitsDefs[traitKey]) === null || _a === void 0 ? void 0 : _a.data) !== null && _b !== void 0 ? _b : {});
                const traitData = await resolveTraitValue(resolverInput);
                return Object.assign(Object.assign({}, acc), traitData);
            }, resolveValue(resolverInput));
            const defaultAssociations = {
                user: isSessionuserFactory(defaultData.user) ? {
                    create: await defaultData.user.build()
                } : defaultData.user
            };
            const data = Object.assign(Object.assign(Object.assign(Object.assign({}, requiredScalarData), defaultData), defaultAssociations), filteredInputData);
            await handleAfterBuild(data, transientFields);
            return data;
        };
        const buildList = (...args) => Promise.all(normalizeList(...args).map(data => build(data)));
        const pickForConnect = (inputData) => ({
            sessionToken: inputData.sessionToken
        });
        const create = async (inputData = {}) => {
            const data = await build(Object.assign({}, inputData)).then(screen);
            const [transientFields] = destructure(defaultTransientFieldValues, inputData);
            await handleBeforeCreate(data, transientFields);
            const createdData = await getClient().session.create({ data });
            await handleAfterCreate(createdData, transientFields);
            return createdData;
        };
        const createList = (...args) => Promise.all(normalizeList(...args).map(data => create(data)));
        const createForConnect = (inputData = {}) => create(inputData).then(pickForConnect);
        return {
            _factoryFor: "Session",
            build,
            buildList,
            buildCreateInput: build,
            pickForConnect,
            create,
            createList,
            createForConnect,
        };
    };
    const factory = getFactoryWithTraits();
    const useTraits = (name, ...names) => {
        return getFactoryWithTraits([name, ...names]);
    };
    return Object.assign(Object.assign({}, factory), { use: useTraits });
}
/**
 * Define factory for {@link Session} model.
 *
 * @param options
 * @returns factory {@link SessionFactoryInterface}
 */
export const defineSessionFactory = ((options) => {
    return defineSessionFactoryInternal(options, {});
});
defineSessionFactory.withTransientFields = defaultTransientFieldValues => options => defineSessionFactoryInternal(options, defaultTransientFieldValues);
function autoGenerateVerificationTokenScalarsOrEnums({ seq }) {
    return {
        identifier: getScalarFieldValueGenerator().String({ modelName: "VerificationToken", fieldName: "identifier", isId: true, isUnique: false, seq }),
        token: getScalarFieldValueGenerator().String({ modelName: "VerificationToken", fieldName: "token", isId: true, isUnique: false, seq }),
        expires: getScalarFieldValueGenerator().DateTime({ modelName: "VerificationToken", fieldName: "expires", isId: false, isUnique: false, seq })
    };
}
function defineVerificationTokenFactoryInternal({ defaultData: defaultDataResolver, onAfterBuild, onBeforeCreate, onAfterCreate, traits: traitsDefs = {} }, defaultTransientFieldValues) {
    const getFactoryWithTraits = (traitKeys = []) => {
        const seqKey = {};
        const getSeq = () => getSequenceCounter(seqKey);
        const screen = createScreener("VerificationToken", modelFieldDefinitions);
        const handleAfterBuild = createCallbackChain([
            onAfterBuild,
            ...traitKeys.map(traitKey => { var _a; return (_a = traitsDefs[traitKey]) === null || _a === void 0 ? void 0 : _a.onAfterBuild; }),
        ]);
        const handleBeforeCreate = createCallbackChain([
            ...traitKeys.slice().reverse().map(traitKey => { var _a; return (_a = traitsDefs[traitKey]) === null || _a === void 0 ? void 0 : _a.onBeforeCreate; }),
            onBeforeCreate,
        ]);
        const handleAfterCreate = createCallbackChain([
            onAfterCreate,
            ...traitKeys.map(traitKey => { var _a; return (_a = traitsDefs[traitKey]) === null || _a === void 0 ? void 0 : _a.onAfterCreate; }),
        ]);
        const build = async (inputData = {}) => {
            const seq = getSeq();
            const requiredScalarData = autoGenerateVerificationTokenScalarsOrEnums({ seq });
            const resolveValue = normalizeResolver(defaultDataResolver !== null && defaultDataResolver !== void 0 ? defaultDataResolver : {});
            const [transientFields, filteredInputData] = destructure(defaultTransientFieldValues, inputData);
            const resolverInput = Object.assign({ seq }, transientFields);
            const defaultData = await traitKeys.reduce(async (queue, traitKey) => {
                var _a, _b;
                const acc = await queue;
                const resolveTraitValue = normalizeResolver((_b = (_a = traitsDefs[traitKey]) === null || _a === void 0 ? void 0 : _a.data) !== null && _b !== void 0 ? _b : {});
                const traitData = await resolveTraitValue(resolverInput);
                return Object.assign(Object.assign({}, acc), traitData);
            }, resolveValue(resolverInput));
            const defaultAssociations = {};
            const data = Object.assign(Object.assign(Object.assign(Object.assign({}, requiredScalarData), defaultData), defaultAssociations), filteredInputData);
            await handleAfterBuild(data, transientFields);
            return data;
        };
        const buildList = (...args) => Promise.all(normalizeList(...args).map(data => build(data)));
        const pickForConnect = (inputData) => ({
            identifier: inputData.identifier,
            token: inputData.token
        });
        const create = async (inputData = {}) => {
            const data = await build(Object.assign({}, inputData)).then(screen);
            const [transientFields] = destructure(defaultTransientFieldValues, inputData);
            await handleBeforeCreate(data, transientFields);
            const createdData = await getClient().verificationToken.create({ data });
            await handleAfterCreate(createdData, transientFields);
            return createdData;
        };
        const createList = (...args) => Promise.all(normalizeList(...args).map(data => create(data)));
        const createForConnect = (inputData = {}) => create(inputData).then(pickForConnect);
        return {
            _factoryFor: "VerificationToken",
            build,
            buildList,
            buildCreateInput: build,
            pickForConnect,
            create,
            createList,
            createForConnect,
        };
    };
    const factory = getFactoryWithTraits();
    const useTraits = (name, ...names) => {
        return getFactoryWithTraits([name, ...names]);
    };
    return Object.assign(Object.assign({}, factory), { use: useTraits });
}
/**
 * Define factory for {@link VerificationToken} model.
 *
 * @param options
 * @returns factory {@link VerificationTokenFactoryInterface}
 */
export const defineVerificationTokenFactory = ((options) => {
    return defineVerificationTokenFactoryInternal(options !== null && options !== void 0 ? options : {}, {});
});
defineVerificationTokenFactory.withTransientFields = defaultTransientFieldValues => options => defineVerificationTokenFactoryInternal(options !== null && options !== void 0 ? options : {}, defaultTransientFieldValues);
function isAuthenticatoruserFactory(x) {
    return (x === null || x === void 0 ? void 0 : x._factoryFor) === "User";
}
function autoGenerateAuthenticatorScalarsOrEnums({ seq }) {
    return {
        credentialID: getScalarFieldValueGenerator().String({ modelName: "Authenticator", fieldName: "credentialID", isId: true, isUnique: true, seq }),
        providerAccountId: getScalarFieldValueGenerator().String({ modelName: "Authenticator", fieldName: "providerAccountId", isId: false, isUnique: false, seq }),
        credentialPublicKey: getScalarFieldValueGenerator().String({ modelName: "Authenticator", fieldName: "credentialPublicKey", isId: false, isUnique: false, seq }),
        counter: getScalarFieldValueGenerator().Int({ modelName: "Authenticator", fieldName: "counter", isId: false, isUnique: false, seq }),
        credentialDeviceType: getScalarFieldValueGenerator().String({ modelName: "Authenticator", fieldName: "credentialDeviceType", isId: false, isUnique: false, seq }),
        credentialBackedUp: getScalarFieldValueGenerator().Boolean({ modelName: "Authenticator", fieldName: "credentialBackedUp", isId: false, isUnique: false, seq })
    };
}
function defineAuthenticatorFactoryInternal({ defaultData: defaultDataResolver, onAfterBuild, onBeforeCreate, onAfterCreate, traits: traitsDefs = {} }, defaultTransientFieldValues) {
    const getFactoryWithTraits = (traitKeys = []) => {
        const seqKey = {};
        const getSeq = () => getSequenceCounter(seqKey);
        const screen = createScreener("Authenticator", modelFieldDefinitions);
        const handleAfterBuild = createCallbackChain([
            onAfterBuild,
            ...traitKeys.map(traitKey => { var _a; return (_a = traitsDefs[traitKey]) === null || _a === void 0 ? void 0 : _a.onAfterBuild; }),
        ]);
        const handleBeforeCreate = createCallbackChain([
            ...traitKeys.slice().reverse().map(traitKey => { var _a; return (_a = traitsDefs[traitKey]) === null || _a === void 0 ? void 0 : _a.onBeforeCreate; }),
            onBeforeCreate,
        ]);
        const handleAfterCreate = createCallbackChain([
            onAfterCreate,
            ...traitKeys.map(traitKey => { var _a; return (_a = traitsDefs[traitKey]) === null || _a === void 0 ? void 0 : _a.onAfterCreate; }),
        ]);
        const build = async (inputData = {}) => {
            const seq = getSeq();
            const requiredScalarData = autoGenerateAuthenticatorScalarsOrEnums({ seq });
            const resolveValue = normalizeResolver(defaultDataResolver);
            const [transientFields, filteredInputData] = destructure(defaultTransientFieldValues, inputData);
            const resolverInput = Object.assign({ seq }, transientFields);
            const defaultData = await traitKeys.reduce(async (queue, traitKey) => {
                var _a, _b;
                const acc = await queue;
                const resolveTraitValue = normalizeResolver((_b = (_a = traitsDefs[traitKey]) === null || _a === void 0 ? void 0 : _a.data) !== null && _b !== void 0 ? _b : {});
                const traitData = await resolveTraitValue(resolverInput);
                return Object.assign(Object.assign({}, acc), traitData);
            }, resolveValue(resolverInput));
            const defaultAssociations = {
                user: isAuthenticatoruserFactory(defaultData.user) ? {
                    create: await defaultData.user.build()
                } : defaultData.user
            };
            const data = Object.assign(Object.assign(Object.assign(Object.assign({}, requiredScalarData), defaultData), defaultAssociations), filteredInputData);
            await handleAfterBuild(data, transientFields);
            return data;
        };
        const buildList = (...args) => Promise.all(normalizeList(...args).map(data => build(data)));
        const pickForConnect = (inputData) => ({
            userId: inputData.userId,
            credentialID: inputData.credentialID
        });
        const create = async (inputData = {}) => {
            const data = await build(Object.assign({}, inputData)).then(screen);
            const [transientFields] = destructure(defaultTransientFieldValues, inputData);
            await handleBeforeCreate(data, transientFields);
            const createdData = await getClient().authenticator.create({ data });
            await handleAfterCreate(createdData, transientFields);
            return createdData;
        };
        const createList = (...args) => Promise.all(normalizeList(...args).map(data => create(data)));
        const createForConnect = (inputData = {}) => create(inputData).then(pickForConnect);
        return {
            _factoryFor: "Authenticator",
            build,
            buildList,
            buildCreateInput: build,
            pickForConnect,
            create,
            createList,
            createForConnect,
        };
    };
    const factory = getFactoryWithTraits();
    const useTraits = (name, ...names) => {
        return getFactoryWithTraits([name, ...names]);
    };
    return Object.assign(Object.assign({}, factory), { use: useTraits });
}
/**
 * Define factory for {@link Authenticator} model.
 *
 * @param options
 * @returns factory {@link AuthenticatorFactoryInterface}
 */
export const defineAuthenticatorFactory = ((options) => {
    return defineAuthenticatorFactoryInternal(options, {});
});
defineAuthenticatorFactory.withTransientFields = defaultTransientFieldValues => options => defineAuthenticatorFactoryInternal(options, defaultTransientFieldValues);
