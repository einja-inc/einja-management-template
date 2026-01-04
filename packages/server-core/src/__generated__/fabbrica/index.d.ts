import type { User } from "@prisma/client";
import type { Account } from "@prisma/client";
import type { Session } from "@prisma/client";
import type { VerificationToken } from "@prisma/client";
import type { Authenticator } from "@prisma/client";
import type { UserStatus } from "@prisma/client";
import type { UserRole } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import type { Resolver } from "@quramy/prisma-fabbrica/lib/internal";
export { resetSequence, registerScalarFieldValueGenerator, resetScalarFieldValueGenerator } from "@quramy/prisma-fabbrica/lib/internal";
type BuildDataOptions<TTransients extends Record<string, unknown>> = {
    readonly seq: number;
} & TTransients;
type TraitName = string | symbol;
type CallbackDefineOptions<TCreated, TCreateInput, TTransients extends Record<string, unknown>> = {
    onAfterBuild?: (createInput: TCreateInput, transientFields: TTransients) => void | PromiseLike<void>;
    onBeforeCreate?: (createInput: TCreateInput, transientFields: TTransients) => void | PromiseLike<void>;
    onAfterCreate?: (created: TCreated, transientFields: TTransients) => void | PromiseLike<void>;
};
export declare const initialize: (options: import("@quramy/prisma-fabbrica/lib/internal").InitializeOptions) => void;
type UserFactoryDefineInput = {
    id?: string;
    name?: string | null;
    email?: string;
    emailVerified?: Date | null;
    image?: string | null;
    password?: string | null;
    status?: UserStatus;
    role?: UserRole;
    lastLogin?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
    accounts?: Prisma.AccountCreateNestedManyWithoutUserInput;
    sessions?: Prisma.SessionCreateNestedManyWithoutUserInput;
    Authenticator?: Prisma.AuthenticatorCreateNestedManyWithoutUserInput;
};
type UserTransientFields = Record<string, unknown> & Partial<Record<keyof UserFactoryDefineInput, never>>;
type UserFactoryTrait<TTransients extends Record<string, unknown>> = {
    data?: Resolver<Partial<UserFactoryDefineInput>, BuildDataOptions<TTransients>>;
} & CallbackDefineOptions<User, Prisma.UserCreateInput, TTransients>;
type UserFactoryDefineOptions<TTransients extends Record<string, unknown> = Record<string, unknown>> = {
    defaultData?: Resolver<UserFactoryDefineInput, BuildDataOptions<TTransients>>;
    traits?: {
        [traitName: TraitName]: UserFactoryTrait<TTransients>;
    };
} & CallbackDefineOptions<User, Prisma.UserCreateInput, TTransients>;
type UserTraitKeys<TOptions extends UserFactoryDefineOptions<any>> = Exclude<keyof TOptions["traits"], number>;
export interface UserFactoryInterfaceWithoutTraits<TTransients extends Record<string, unknown>> {
    readonly _factoryFor: "User";
    build(inputData?: Partial<Prisma.UserCreateInput & TTransients>): PromiseLike<Prisma.UserCreateInput>;
    buildCreateInput(inputData?: Partial<Prisma.UserCreateInput & TTransients>): PromiseLike<Prisma.UserCreateInput>;
    buildList(list: readonly Partial<Prisma.UserCreateInput & TTransients>[]): PromiseLike<Prisma.UserCreateInput[]>;
    buildList(count: number, item?: Partial<Prisma.UserCreateInput & TTransients>): PromiseLike<Prisma.UserCreateInput[]>;
    pickForConnect(inputData: User): Pick<User, "id">;
    create(inputData?: Partial<Prisma.UserCreateInput & TTransients>): PromiseLike<User>;
    createList(list: readonly Partial<Prisma.UserCreateInput & TTransients>[]): PromiseLike<User[]>;
    createList(count: number, item?: Partial<Prisma.UserCreateInput & TTransients>): PromiseLike<User[]>;
    createForConnect(inputData?: Partial<Prisma.UserCreateInput & TTransients>): PromiseLike<Pick<User, "id">>;
}
export interface UserFactoryInterface<TTransients extends Record<string, unknown> = Record<string, unknown>, TTraitName extends TraitName = TraitName> extends UserFactoryInterfaceWithoutTraits<TTransients> {
    use(name: TTraitName, ...names: readonly TTraitName[]): UserFactoryInterfaceWithoutTraits<TTransients>;
}
interface UserFactoryBuilder {
    <TOptions extends UserFactoryDefineOptions>(options?: TOptions): UserFactoryInterface<{}, UserTraitKeys<TOptions>>;
    withTransientFields: <TTransients extends UserTransientFields>(defaultTransientFieldValues: TTransients) => <TOptions extends UserFactoryDefineOptions<TTransients>>(options?: TOptions) => UserFactoryInterface<TTransients, UserTraitKeys<TOptions>>;
}
/**
 * Define factory for {@link User} model.
 *
 * @param options
 * @returns factory {@link UserFactoryInterface}
 */
export declare const defineUserFactory: UserFactoryBuilder;
type AccountuserFactory = {
    _factoryFor: "User";
    build: () => PromiseLike<Prisma.UserCreateNestedOneWithoutAccountsInput["create"]>;
};
type AccountFactoryDefineInput = {
    type?: string;
    provider?: string;
    providerAccountId?: string;
    refresh_token?: string | null;
    access_token?: string | null;
    expires_at?: number | null;
    token_type?: string | null;
    scope?: string | null;
    id_token?: string | null;
    session_state?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
    user: AccountuserFactory | Prisma.UserCreateNestedOneWithoutAccountsInput;
};
type AccountTransientFields = Record<string, unknown> & Partial<Record<keyof AccountFactoryDefineInput, never>>;
type AccountFactoryTrait<TTransients extends Record<string, unknown>> = {
    data?: Resolver<Partial<AccountFactoryDefineInput>, BuildDataOptions<TTransients>>;
} & CallbackDefineOptions<Account, Prisma.AccountCreateInput, TTransients>;
type AccountFactoryDefineOptions<TTransients extends Record<string, unknown> = Record<string, unknown>> = {
    defaultData: Resolver<AccountFactoryDefineInput, BuildDataOptions<TTransients>>;
    traits?: {
        [traitName: string | symbol]: AccountFactoryTrait<TTransients>;
    };
} & CallbackDefineOptions<Account, Prisma.AccountCreateInput, TTransients>;
type AccountTraitKeys<TOptions extends AccountFactoryDefineOptions<any>> = Exclude<keyof TOptions["traits"], number>;
export interface AccountFactoryInterfaceWithoutTraits<TTransients extends Record<string, unknown>> {
    readonly _factoryFor: "Account";
    build(inputData?: Partial<Prisma.AccountCreateInput & TTransients>): PromiseLike<Prisma.AccountCreateInput>;
    buildCreateInput(inputData?: Partial<Prisma.AccountCreateInput & TTransients>): PromiseLike<Prisma.AccountCreateInput>;
    buildList(list: readonly Partial<Prisma.AccountCreateInput & TTransients>[]): PromiseLike<Prisma.AccountCreateInput[]>;
    buildList(count: number, item?: Partial<Prisma.AccountCreateInput & TTransients>): PromiseLike<Prisma.AccountCreateInput[]>;
    pickForConnect(inputData: Account): Pick<Account, "provider" | "providerAccountId">;
    create(inputData?: Partial<Prisma.AccountCreateInput & TTransients>): PromiseLike<Account>;
    createList(list: readonly Partial<Prisma.AccountCreateInput & TTransients>[]): PromiseLike<Account[]>;
    createList(count: number, item?: Partial<Prisma.AccountCreateInput & TTransients>): PromiseLike<Account[]>;
    createForConnect(inputData?: Partial<Prisma.AccountCreateInput & TTransients>): PromiseLike<Pick<Account, "provider" | "providerAccountId">>;
}
export interface AccountFactoryInterface<TTransients extends Record<string, unknown> = Record<string, unknown>, TTraitName extends TraitName = TraitName> extends AccountFactoryInterfaceWithoutTraits<TTransients> {
    use(name: TTraitName, ...names: readonly TTraitName[]): AccountFactoryInterfaceWithoutTraits<TTransients>;
}
interface AccountFactoryBuilder {
    <TOptions extends AccountFactoryDefineOptions>(options: TOptions): AccountFactoryInterface<{}, AccountTraitKeys<TOptions>>;
    withTransientFields: <TTransients extends AccountTransientFields>(defaultTransientFieldValues: TTransients) => <TOptions extends AccountFactoryDefineOptions<TTransients>>(options: TOptions) => AccountFactoryInterface<TTransients, AccountTraitKeys<TOptions>>;
}
/**
 * Define factory for {@link Account} model.
 *
 * @param options
 * @returns factory {@link AccountFactoryInterface}
 */
export declare const defineAccountFactory: AccountFactoryBuilder;
type SessionuserFactory = {
    _factoryFor: "User";
    build: () => PromiseLike<Prisma.UserCreateNestedOneWithoutSessionsInput["create"]>;
};
type SessionFactoryDefineInput = {
    sessionToken?: string;
    expires?: Date;
    createdAt?: Date;
    updatedAt?: Date;
    user: SessionuserFactory | Prisma.UserCreateNestedOneWithoutSessionsInput;
};
type SessionTransientFields = Record<string, unknown> & Partial<Record<keyof SessionFactoryDefineInput, never>>;
type SessionFactoryTrait<TTransients extends Record<string, unknown>> = {
    data?: Resolver<Partial<SessionFactoryDefineInput>, BuildDataOptions<TTransients>>;
} & CallbackDefineOptions<Session, Prisma.SessionCreateInput, TTransients>;
type SessionFactoryDefineOptions<TTransients extends Record<string, unknown> = Record<string, unknown>> = {
    defaultData: Resolver<SessionFactoryDefineInput, BuildDataOptions<TTransients>>;
    traits?: {
        [traitName: string | symbol]: SessionFactoryTrait<TTransients>;
    };
} & CallbackDefineOptions<Session, Prisma.SessionCreateInput, TTransients>;
type SessionTraitKeys<TOptions extends SessionFactoryDefineOptions<any>> = Exclude<keyof TOptions["traits"], number>;
export interface SessionFactoryInterfaceWithoutTraits<TTransients extends Record<string, unknown>> {
    readonly _factoryFor: "Session";
    build(inputData?: Partial<Prisma.SessionCreateInput & TTransients>): PromiseLike<Prisma.SessionCreateInput>;
    buildCreateInput(inputData?: Partial<Prisma.SessionCreateInput & TTransients>): PromiseLike<Prisma.SessionCreateInput>;
    buildList(list: readonly Partial<Prisma.SessionCreateInput & TTransients>[]): PromiseLike<Prisma.SessionCreateInput[]>;
    buildList(count: number, item?: Partial<Prisma.SessionCreateInput & TTransients>): PromiseLike<Prisma.SessionCreateInput[]>;
    pickForConnect(inputData: Session): Pick<Session, "sessionToken">;
    create(inputData?: Partial<Prisma.SessionCreateInput & TTransients>): PromiseLike<Session>;
    createList(list: readonly Partial<Prisma.SessionCreateInput & TTransients>[]): PromiseLike<Session[]>;
    createList(count: number, item?: Partial<Prisma.SessionCreateInput & TTransients>): PromiseLike<Session[]>;
    createForConnect(inputData?: Partial<Prisma.SessionCreateInput & TTransients>): PromiseLike<Pick<Session, "sessionToken">>;
}
export interface SessionFactoryInterface<TTransients extends Record<string, unknown> = Record<string, unknown>, TTraitName extends TraitName = TraitName> extends SessionFactoryInterfaceWithoutTraits<TTransients> {
    use(name: TTraitName, ...names: readonly TTraitName[]): SessionFactoryInterfaceWithoutTraits<TTransients>;
}
interface SessionFactoryBuilder {
    <TOptions extends SessionFactoryDefineOptions>(options: TOptions): SessionFactoryInterface<{}, SessionTraitKeys<TOptions>>;
    withTransientFields: <TTransients extends SessionTransientFields>(defaultTransientFieldValues: TTransients) => <TOptions extends SessionFactoryDefineOptions<TTransients>>(options: TOptions) => SessionFactoryInterface<TTransients, SessionTraitKeys<TOptions>>;
}
/**
 * Define factory for {@link Session} model.
 *
 * @param options
 * @returns factory {@link SessionFactoryInterface}
 */
export declare const defineSessionFactory: SessionFactoryBuilder;
type VerificationTokenFactoryDefineInput = {
    identifier?: string;
    token?: string;
    expires?: Date;
};
type VerificationTokenTransientFields = Record<string, unknown> & Partial<Record<keyof VerificationTokenFactoryDefineInput, never>>;
type VerificationTokenFactoryTrait<TTransients extends Record<string, unknown>> = {
    data?: Resolver<Partial<VerificationTokenFactoryDefineInput>, BuildDataOptions<TTransients>>;
} & CallbackDefineOptions<VerificationToken, Prisma.VerificationTokenCreateInput, TTransients>;
type VerificationTokenFactoryDefineOptions<TTransients extends Record<string, unknown> = Record<string, unknown>> = {
    defaultData?: Resolver<VerificationTokenFactoryDefineInput, BuildDataOptions<TTransients>>;
    traits?: {
        [traitName: TraitName]: VerificationTokenFactoryTrait<TTransients>;
    };
} & CallbackDefineOptions<VerificationToken, Prisma.VerificationTokenCreateInput, TTransients>;
type VerificationTokenTraitKeys<TOptions extends VerificationTokenFactoryDefineOptions<any>> = Exclude<keyof TOptions["traits"], number>;
export interface VerificationTokenFactoryInterfaceWithoutTraits<TTransients extends Record<string, unknown>> {
    readonly _factoryFor: "VerificationToken";
    build(inputData?: Partial<Prisma.VerificationTokenCreateInput & TTransients>): PromiseLike<Prisma.VerificationTokenCreateInput>;
    buildCreateInput(inputData?: Partial<Prisma.VerificationTokenCreateInput & TTransients>): PromiseLike<Prisma.VerificationTokenCreateInput>;
    buildList(list: readonly Partial<Prisma.VerificationTokenCreateInput & TTransients>[]): PromiseLike<Prisma.VerificationTokenCreateInput[]>;
    buildList(count: number, item?: Partial<Prisma.VerificationTokenCreateInput & TTransients>): PromiseLike<Prisma.VerificationTokenCreateInput[]>;
    pickForConnect(inputData: VerificationToken): Pick<VerificationToken, "identifier" | "token">;
    create(inputData?: Partial<Prisma.VerificationTokenCreateInput & TTransients>): PromiseLike<VerificationToken>;
    createList(list: readonly Partial<Prisma.VerificationTokenCreateInput & TTransients>[]): PromiseLike<VerificationToken[]>;
    createList(count: number, item?: Partial<Prisma.VerificationTokenCreateInput & TTransients>): PromiseLike<VerificationToken[]>;
    createForConnect(inputData?: Partial<Prisma.VerificationTokenCreateInput & TTransients>): PromiseLike<Pick<VerificationToken, "identifier" | "token">>;
}
export interface VerificationTokenFactoryInterface<TTransients extends Record<string, unknown> = Record<string, unknown>, TTraitName extends TraitName = TraitName> extends VerificationTokenFactoryInterfaceWithoutTraits<TTransients> {
    use(name: TTraitName, ...names: readonly TTraitName[]): VerificationTokenFactoryInterfaceWithoutTraits<TTransients>;
}
interface VerificationTokenFactoryBuilder {
    <TOptions extends VerificationTokenFactoryDefineOptions>(options?: TOptions): VerificationTokenFactoryInterface<{}, VerificationTokenTraitKeys<TOptions>>;
    withTransientFields: <TTransients extends VerificationTokenTransientFields>(defaultTransientFieldValues: TTransients) => <TOptions extends VerificationTokenFactoryDefineOptions<TTransients>>(options?: TOptions) => VerificationTokenFactoryInterface<TTransients, VerificationTokenTraitKeys<TOptions>>;
}
/**
 * Define factory for {@link VerificationToken} model.
 *
 * @param options
 * @returns factory {@link VerificationTokenFactoryInterface}
 */
export declare const defineVerificationTokenFactory: VerificationTokenFactoryBuilder;
type AuthenticatoruserFactory = {
    _factoryFor: "User";
    build: () => PromiseLike<Prisma.UserCreateNestedOneWithoutAuthenticatorInput["create"]>;
};
type AuthenticatorFactoryDefineInput = {
    credentialID?: string;
    providerAccountId?: string;
    credentialPublicKey?: string;
    counter?: number;
    credentialDeviceType?: string;
    credentialBackedUp?: boolean;
    transports?: string | null;
    user: AuthenticatoruserFactory | Prisma.UserCreateNestedOneWithoutAuthenticatorInput;
};
type AuthenticatorTransientFields = Record<string, unknown> & Partial<Record<keyof AuthenticatorFactoryDefineInput, never>>;
type AuthenticatorFactoryTrait<TTransients extends Record<string, unknown>> = {
    data?: Resolver<Partial<AuthenticatorFactoryDefineInput>, BuildDataOptions<TTransients>>;
} & CallbackDefineOptions<Authenticator, Prisma.AuthenticatorCreateInput, TTransients>;
type AuthenticatorFactoryDefineOptions<TTransients extends Record<string, unknown> = Record<string, unknown>> = {
    defaultData: Resolver<AuthenticatorFactoryDefineInput, BuildDataOptions<TTransients>>;
    traits?: {
        [traitName: string | symbol]: AuthenticatorFactoryTrait<TTransients>;
    };
} & CallbackDefineOptions<Authenticator, Prisma.AuthenticatorCreateInput, TTransients>;
type AuthenticatorTraitKeys<TOptions extends AuthenticatorFactoryDefineOptions<any>> = Exclude<keyof TOptions["traits"], number>;
export interface AuthenticatorFactoryInterfaceWithoutTraits<TTransients extends Record<string, unknown>> {
    readonly _factoryFor: "Authenticator";
    build(inputData?: Partial<Prisma.AuthenticatorCreateInput & TTransients>): PromiseLike<Prisma.AuthenticatorCreateInput>;
    buildCreateInput(inputData?: Partial<Prisma.AuthenticatorCreateInput & TTransients>): PromiseLike<Prisma.AuthenticatorCreateInput>;
    buildList(list: readonly Partial<Prisma.AuthenticatorCreateInput & TTransients>[]): PromiseLike<Prisma.AuthenticatorCreateInput[]>;
    buildList(count: number, item?: Partial<Prisma.AuthenticatorCreateInput & TTransients>): PromiseLike<Prisma.AuthenticatorCreateInput[]>;
    pickForConnect(inputData: Authenticator): Pick<Authenticator, "userId" | "credentialID">;
    create(inputData?: Partial<Prisma.AuthenticatorCreateInput & TTransients>): PromiseLike<Authenticator>;
    createList(list: readonly Partial<Prisma.AuthenticatorCreateInput & TTransients>[]): PromiseLike<Authenticator[]>;
    createList(count: number, item?: Partial<Prisma.AuthenticatorCreateInput & TTransients>): PromiseLike<Authenticator[]>;
    createForConnect(inputData?: Partial<Prisma.AuthenticatorCreateInput & TTransients>): PromiseLike<Pick<Authenticator, "userId" | "credentialID">>;
}
export interface AuthenticatorFactoryInterface<TTransients extends Record<string, unknown> = Record<string, unknown>, TTraitName extends TraitName = TraitName> extends AuthenticatorFactoryInterfaceWithoutTraits<TTransients> {
    use(name: TTraitName, ...names: readonly TTraitName[]): AuthenticatorFactoryInterfaceWithoutTraits<TTransients>;
}
interface AuthenticatorFactoryBuilder {
    <TOptions extends AuthenticatorFactoryDefineOptions>(options: TOptions): AuthenticatorFactoryInterface<{}, AuthenticatorTraitKeys<TOptions>>;
    withTransientFields: <TTransients extends AuthenticatorTransientFields>(defaultTransientFieldValues: TTransients) => <TOptions extends AuthenticatorFactoryDefineOptions<TTransients>>(options: TOptions) => AuthenticatorFactoryInterface<TTransients, AuthenticatorTraitKeys<TOptions>>;
}
/**
 * Define factory for {@link Authenticator} model.
 *
 * @param options
 * @returns factory {@link AuthenticatorFactoryInterface}
 */
export declare const defineAuthenticatorFactory: AuthenticatorFactoryBuilder;
