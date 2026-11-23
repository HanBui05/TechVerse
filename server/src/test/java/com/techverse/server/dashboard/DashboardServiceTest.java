package com.techverse.server.dashboard;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

import com.techverse.server.entity.Role;
import com.techverse.server.entity.User;
import com.techverse.server.entity.UserRole;
import com.techverse.server.enums.RoleName;
import com.techverse.server.exception.CustomException;
import com.techverse.server.repository.DashboardRepository;
import com.techverse.server.repository.UserRepository;
import com.techverse.server.service.impl.DashboardService;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;

import java.math.BigDecimal;
import java.util.*;

/** Role checks, number conversion and failure rules of the dashboard service, without Spring. */
class DashboardServiceTest {
    final DashboardRepository dashboard = mock(DashboardRepository.class);
    final UserRepository users = mock(UserRepository.class);
    final DashboardService service = new DashboardService(dashboard, users);
    final UUID actor = UUID.randomUUID();

    @BeforeEach
    void admin() {
        as(user(true, RoleName.ADMIN));
    }

    // Built before when(...): Mockito rejects stubbing inside another stubbing.
    void as(User user) {
        when(users.findWithRolesById(actor)).thenReturn(Optional.of(user));
    }

    @Test
    void emptySumsBecomeZeroAndNumericsAreRead() {
        var row = new HashMap<String, Object>();
        row.put("users_total", 3L);
        row.put("all_orders", 2L);
        row.put("all_gross", new BigDecimal("250000"));
        row.put("last30_gross", null);
        when(dashboard.adminCounts()).thenReturn(row);

        var result = service.admin(actor);

        assertThat(result.users().total()).isEqualTo(3);
        assertThat(result.revenue().allTime().paidOrders()).isEqualTo(2);
        assertThat(result.revenue().allTime().grossAmount()).isEqualTo(250_000);
        assertThat(result.revenue().last30Days().grossAmount()).isZero();
    }

    @Test
    void aTotalPastTheJavascriptSafeIntegerFailsInsteadOfReturningAWrongNumber() {
        when(dashboard.adminCounts()).thenReturn(Map.of("all_gross", BigDecimal.valueOf((1L << 53) - 1)));
        assertThat(service.admin(actor).revenue().allTime().grossAmount()).isEqualTo((1L << 53) - 1);

        when(dashboard.adminCounts()).thenReturn(Map.of("all_gross", BigDecimal.valueOf(1L << 53)));
        assertThatThrownBy(() -> service.admin(actor)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void aFailingCountFailsTheWholeRequest() {
        when(dashboard.adminCounts()).thenThrow(new DataAccessResourceFailureException("down"));
        assertThatThrownBy(() -> service.admin(actor)).isInstanceOf(DataAccessResourceFailureException.class);
    }

    @Test
    void theRoleMustBeHeldByAnActiveAccount() {
        when(dashboard.moderatorCounts()).thenReturn(Map.of());
        assertThatThrownBy(() -> service.moderator(actor)).isInstanceOf(CustomException.class);

        as(user(false, RoleName.ADMIN));
        assertThatThrownBy(() -> service.admin(actor)).isInstanceOf(CustomException.class);

        when(users.findWithRolesById(actor)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.admin(actor)).isInstanceOf(CustomException.class);

        as(user(true, RoleName.ADMIN, RoleName.MODERATOR));
        assertThat(service.moderator(actor).reports().open()).isZero();
        verify(dashboard, never()).adminCounts();
    }

    static User user(boolean active, RoleName... roles) {
        var user = mock(User.class);
        when(user.isActive()).thenReturn(active);
        var links = new HashSet<UserRole>();
        for (var name : roles) {
            var role = mock(Role.class);
            when(role.getName()).thenReturn(name);
            var link = mock(UserRole.class);
            when(link.getRole()).thenReturn(role);
            links.add(link);
        }
        when(user.getUserRoles()).thenReturn(links);
        return user;
    }
}
