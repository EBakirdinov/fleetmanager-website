<?php

namespace App\Controller\Api;

use App\Service\AccountService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

/**
 * @Route("/api/session")
 */
class SessionController extends AbstractController
{
    private $accountService;

    public function __construct(AccountService $accountService)
    {
        $this->accountService = $accountService;
    }

    /**
     * @Route("/login", name="api_session_login", methods={"POST"})
     */
    public function login(Request $request): JsonResponse
    {
        $data = $this->decodeJson($request);
        if (empty($data['email']) || empty($data['password'])) {
            return new JsonResponse(['error' => 'Email and password are required.'], 400);
        }

        $result = $this->accountService->login($data);
        if ($result['status'] < 200 || $result['status'] >= 300) {
            $message = $this->extractErrorMessage($result['body']) ?? 'Invalid credentials.';
            return new JsonResponse(['error' => $message], $result['status'] >= 400 ? $result['status'] : 401);
        }

        $user = $this->accountService->getUserData();
        return new JsonResponse(['user' => $user]);
    }

    /**
     * @Route("/register", name="api_session_register", methods={"POST"})
     */
    public function register(Request $request): JsonResponse
    {
        $data = $this->decodeJson($request);
        if (empty($data['email']) || empty($data['password']) || empty($data['companyName'])) {
            return new JsonResponse(['error' => 'Email, password and company name are required.'], 400);
        }

        $result = $this->accountService->register($data);
        if ($result['status'] < 200 || $result['status'] >= 300 || empty($result['body']['token'])) {
            $message = $this->extractErrorMessage($result['body']) ?? 'Registration failed.';
            return new JsonResponse(['error' => $message], $result['status'] >= 400 ? $result['status'] : 400);
        }

        $user = $this->accountService->getUserData();
        return new JsonResponse(['user' => $user]);
    }

    /**
     * @Route("/me", name="api_session_me", methods={"GET"})
     */
    public function me(): JsonResponse
    {
        if (!$this->accountService->isAuthenticated()) {
            return new JsonResponse(['error' => 'Not authenticated.'], 401);
        }

        $user = $this->accountService->getUserData();
        if (!$user) {
            $this->accountService->logout();
            return new JsonResponse(['error' => 'Session expired.'], 401);
        }

        return new JsonResponse(['user' => $user]);
    }

    /**
     * @Route("/logout", name="api_session_logout", methods={"POST"})
     */
    public function logout(): JsonResponse
    {
        $this->accountService->logout();
        return new JsonResponse(['ok' => true]);
    }

    private function decodeJson(Request $request): array
    {
        $raw = (string) $request->getContent();
        $data = json_decode($raw, true);
        return is_array($data) ? $data : [];
    }

    private function extractErrorMessage($body): ?string
    {
        if (!is_array($body)) {
            return null;
        }
        return $body['message']
            ?? $body['error']
            ?? $body['detail']
            ?? ($body['errors'][0]['message'] ?? null);
    }
}
