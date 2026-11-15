package com.techverse.server.service.impl;

import com.techverse.server.dto.request.CourseWriteRequest;
import com.techverse.server.exception.*;

import org.springframework.stereotype.Component;

/** Whole VND: 0 (free) or 10.000–50.000.000 (user decision 2026-11-14); mirrors ck_courses_price. */
@Component
public class CoursePriceService {
    public static final long MIN = 10_000;
    public static final long MAX = 50_000_000;

    /** The request's price; absent, non-integer or out-of-range values are rejected. */
    public long validate(CourseWriteRequest request) {
        Long amount = request.getPriceAmount();
        if (request.isPriceMalformed() || amount == null || (amount != 0 && (amount < MIN || amount > MAX)))
            throw new CustomException(ErrorCode.COURSE_PRICE_INVALID);
        return amount;
    }
}
