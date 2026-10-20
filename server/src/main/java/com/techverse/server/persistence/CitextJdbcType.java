package com.techverse.server.persistence;

import java.sql.Types;
import org.hibernate.type.descriptor.jdbc.VarcharJdbcType;

/**
 * Maps PostgreSQL {@code citext} as JDBC {@link Types#OTHER} for schema validation
 * while retaining String-based binding and extraction.
 */
public final class CitextJdbcType extends VarcharJdbcType {

	public static final CitextJdbcType INSTANCE = new CitextJdbcType();

	@Override
	public int getJdbcTypeCode() {
		return Types.OTHER;
	}

	@Override
	public String getFriendlyName() {
		return "CITEXT";
	}
}
