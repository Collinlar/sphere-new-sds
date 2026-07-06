/** Disambiguates users → institutions when owner_user_id FK also exists. */
export const USER_INSTITUTION_EMBED = 'institutions!users_institution_id_fkey'

export const USER_WITH_INSTITUTION_NAME = `*, ${USER_INSTITUTION_EMBED}(name)` as const
export const USER_WITH_INSTITUTION_NAME_MODULES = `*, ${USER_INSTITUTION_EMBED}(name, modules)` as const
export const USER_WITH_INSTITUTION_NAME_ID = `*, ${USER_INSTITUTION_EMBED}(name, id)` as const
export const USER_LIST_WITH_INSTITUTION = `id, name, email, role, subscription_tier, institution_id, created_at, ${USER_INSTITUTION_EMBED}(name)` as const
