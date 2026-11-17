package com.techverse.server.course;

import static org.assertj.core.api.Assertions.*;

import com.techverse.server.dto.request.CourseWriteRequest;
import com.techverse.server.exception.*;
import com.techverse.server.service.impl.CoursePriceService;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import tools.jackson.databind.json.JsonMapper;

class CoursePriceServiceTest {
    final CoursePriceService service = new CoursePriceService();
    final JsonMapper json = JsonMapper.builder().build();

    private long validate(String price) {
        return service.validate(json.readValue("{\"action\":\"SAVE\",\"priceAmount\":" + price + "}", CourseWriteRequest.class));
    }

    @ParameterizedTest
    @ValueSource(strings = {"0", "10000", "10001", "50000000"})
    void acceptsFreeAndTheAllowedRange(String price) {
        assertThat(validate(price)).isEqualTo(Long.parseLong(price));
    }

    @ParameterizedTest
    @ValueSource(strings = {"-1", "1", "9999", "50000001", "10000.5", "1e4", "\"10000\"", "null", "true", "99999999999999999999"})
    void rejectsEverythingElse(String price) {
        assertThatThrownBy(() -> validate(price))
                .isInstanceOf(CustomException.class)
                .extracting(e -> ((CustomException) e).getErrorCode())
                .isEqualTo(ErrorCode.COURSE_PRICE_INVALID);
    }

    @Test
    void missingPriceIsInvalidWhenRequired() {
        var request = json.readValue("{\"action\":\"SAVE\"}", CourseWriteRequest.class);
        assertThatThrownBy(() -> service.validate(request)).isInstanceOf(CustomException.class);
    }
}
