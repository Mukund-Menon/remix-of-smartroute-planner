import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core';



// Auth tables for better-auth
export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", {
    mode: "timestamp",
  }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", {
    mode: "timestamp",
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
});

// Travel Companion app tables
export const trips = sqliteTable('trips', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  source: text('source').notNull(),
  destination: text('destination').notNull(),
  sourceCoordinates: text('source_coordinates'),
  destinationCoordinates: text('destination_coordinates'),
  travelDate: text('travel_date').notNull(),
  travelTime: text('travel_time').notNull(),
  transportMode: text('transport_mode').notNull(),
  optimizationMode: text('optimization_mode').notNull(),
  status: text('status').notNull().default('active'),
  routeData: text('route_data', { mode: 'json' }),
  routeGeometry: text('route_geometry', { mode: 'json' }),
  matchRadius: integer('match_radius').notNull().default(10),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const userProfiles = sqliteTable('user_profiles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  phone: text('phone'),
  emergencyContactName: text('emergency_contact_name'),
  emergencyContactPhone: text('emergency_contact_phone'),
  travelPreferences: text('travel_preferences', { mode: 'json' }),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const groups = sqliteTable('groups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  tripId: integer('trip_id').references(() => trips.id, { onDelete: 'set null' }),
  createdBy: text('created_by').notNull().references(() => user.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('active'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const groupMembers = sqliteTable('group_members', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  groupId: integer('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('member'),
  joinedAt: text('joined_at').notNull(),
});

export const tripMatches = sqliteTable('trip_matches', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tripId: integer('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  matchedTripId: integer('matched_trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  matchScore: integer('match_score').notNull(),
  status: text('status').notNull().default('pending'),
  createdAt: text('created_at').notNull(),
});

export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  groupId: integer('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  message: text('message').notNull(),
  createdAt: text('created_at').notNull(),
});

export const emergencyContacts = sqliteTable('emergency_contacts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  email: text('email').notNull(),
  relationship: text('relationship'),
  createdAt: text('created_at').notNull(),
});

export const emergencyAlerts = sqliteTable('emergency_alerts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  tripId: integer('trip_id').references(() => trips.id, { onDelete: 'set null' }),
  alertType: text('alert_type').notNull(),
  locationLat: real('location_lat'),
  locationLng: real('location_lng'),
  locationName: text('location_name'),
  message: text('message').notNull(),
  sentTo: text('sent_to', { mode: 'json' }),
  createdAt: text('created_at').notNull(),
});