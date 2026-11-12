package com.neobank.service;

import com.neobank.exception.UserNotFoundException;
import com.neobank.model.dto.CreateUserRequest;
import com.neobank.model.dto.UserResponse;
import com.neobank.model.entity.User;
import com.neobank.repository.UserJpaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Business logic for user management.
 *
 * [R1] HashMap userCache: in-memory lookup cache keyed by user id.
 * HashMap chosen because O(1) average-case get/put fits the "quick lookup
 * by known id" pattern — no ordering needed, no duplicate-key constraint beyond id.
 *
 * [R4] Stream operations used for list projection and filtering.
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class UserService {

    private final UserJpaRepository userRepo;
    private final BCryptPasswordEncoder passwordEncoder;

    /**
     * [R1] In-memory HashMap cache: maps user id → UserResponse.
     * Populated on first access; invalidated on create/update.
     * Avoids repeated DB round-trips for frequently read user profiles.
     */
    private final Map<Long, UserResponse> userCache = new HashMap<>();

    // ── CREATE ───────────────────────────────────────────────────────────────

    /**
     * Creates a new bank customer from the request body.
     *
     * @param request validated creation request (name, email, phone, address)
     * @return the persisted user as a response DTO
     */
    public User findByEmail(String email) {
        return userRepo.findByEmail(email).orElseThrow(() -> new UserNotFoundException(0L));
    }

    public boolean existsByEmail(String email) {
        return userRepo.existsByEmail(email);
    }

    public UserResponse createUser(CreateUserRequest request) {
        log.info("Creating user with email={}", request.getEmail());

        User user = User.builder()
                .name(request.getName())
                .email(request.getEmail())
                .phone(request.getPhone())
                .address(request.getAddress())
                .build();

        User saved = userRepo.save(user);
        UserResponse response = toResponse(saved);

        // [R1] Cache the new user immediately to serve subsequent reads
        userCache.put(saved.getId(), response);
        log.debug("User id={} added to cache", saved.getId());
        return response;
    }

    // ── READ ─────────────────────────────────────────────────────────────────

    /**
     * Returns all users as response DTOs.
     *
     * [R4] Uses Stream.map() to project entities → DTOs without a for-loop.
     * [R3] Method reference toResponse acts as a Function<User, UserResponse>.
     *
     * @return list of all users
     */
    @Transactional(readOnly = true)
    public List<UserResponse> getAllUsers() {
        return userRepo.findAll()
                .stream()
                // [R3] Lambda as Function<User, UserResponse> — projects entity to DTO
                .map(this::toResponse)
                // [R4] collect terminal operation
                .collect(Collectors.toList());
    }

    /**
     * Finds a user by id, using the in-memory cache when available.
     *
     * @param id the user's primary key
     * @return the user response DTO
     * @throws UserNotFoundException if no user exists with the given id
     */
    @Transactional(readOnly = true)
    public UserResponse getUserById(Long id) {
        // [R1] Check HashMap cache before hitting the database
        if (userCache.containsKey(id)) {
            log.debug("Cache hit for user id={}", id);
            return userCache.get(id);
        }

        User user = userRepo.findByIdWithAccounts(id)
                .orElseThrow(() -> new UserNotFoundException(id));

        UserResponse response = toResponse(user);
        userCache.put(id, response);
        return response;
    }

    /**
     * Finds a user entity by id for use by other services.
     *
     * @param id the user's primary key
     * @return the JPA User entity
     * @throws UserNotFoundException if not found
     */
    @Transactional(readOnly = true)
    public User getUserEntityById(Long id) {
        return userRepo.findById(id)
                .orElseThrow(() -> new UserNotFoundException(id));
    }

    // ── HELPERS ──────────────────────────────────────────────────────────────

    /**
     * Maps a User entity to a UserResponse DTO.
     *
     * @param user the entity
     * @return the response DTO
     */
    public UserResponse updateProfilePicture(Long userId, String pictureData) {
        User user = userRepo.findById(userId)
                .orElseThrow(() -> new UserNotFoundException(userId));
        user.setProfilePicture(pictureData);
        User saved = userRepo.save(user);
        userCache.remove(userId);
        return toResponse(saved);
    }

    private UserResponse toResponse(User user) {
        return UserResponse.builder()
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .phone(user.getPhone())
                .address(user.getAddress())
                .createdAt(user.getCreatedAt())
                .accountCount(user.getAccounts() != null ? user.getAccounts().size() : 0)
                .profilePicture(user.getProfilePicture())
                .build();
    }
}
