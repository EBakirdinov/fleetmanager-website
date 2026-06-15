<?php

namespace App\Controller;

use App\Service\AccountService;
use Symfony\Component\HttpFoundation\Cookie;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\Session\SessionInterface;
use Symfony\Component\Routing\Annotation\Route;

class FleetController extends BaseFleetController
{
    private $accountService;

    public function __construct(AccountService $accountService)
    {
        $this->accountService = $accountService;
    }

    // ----------------------------------------------------------------
    // Login
    // ----------------------------------------------------------------

    /**
     * @Route("/login", name="fleet_login", methods={"GET", "POST"})
     */
    public function login(Request $request, SessionInterface $session): Response
    {
        if ($this->isAuthenticated($session)) {
            return $this->redirectToRoute('fleet_dashboard');
        }

        if ($request->isMethod('POST')) {
            $email      = trim($request->request->get('email', ''));
            $password   = trim($request->request->get('password', ''));
            $rememberMe = (bool) $request->request->get('remember_me');

            $loginResponse = $this->accountService->login([
                'username' => $email,
                'password' => $password,
            ]);

            if (!empty($loginResponse['token'])) {
                $token = $loginResponse['token'];
                $session->set('stoken', $token);

                $userData = $this->accountService->getCurrentUser();
                $session->set('user_email', $userData['username'] ?? $email);

                $session->set('first_name', $userData['firstName'] ?? '');
                $session->set('last_name', $userData['lastName'] ?? '');

                $session->set('fleet_last_email', $email);

                $response = $this->redirectToRoute('fleet_dashboard');

                if ($rememberMe) {
                    $encryptedToken = $this->accountService->encryptLoginToken($token);
                    
                    $cookie = new Cookie('scheduler_rememberme', $encryptedToken, time() + (3600 * 24 * 7));

                    $response->headers->setCookie($cookie);
                }

                return $response;
            }

            $error = $loginResponse['message'] ?? 'Invalid email or password. Please try again.';

            $session->set('fleet_login_error', $error);
            $session->set('fleet_last_email', $email);

            return $this->redirectToRoute('fleet_login');
        }

        return $this->render('Fleet/login.html.twig');
    }

    /**
     * @Route("/logout", name="fleet_logout")
     */
    public function logout(SessionInterface $session): Response
    {
        $session->remove('stoken');
        $session->remove('user_name');
        $session->remove('user_email');

        return $this->redirectToRoute('fleet_login');
    }

    // ----------------------------------------------------------------
    // Dashboard
    // ----------------------------------------------------------------

    /**
     * @Route("/dashboard", name="fleet_dashboard")
     */
    public function dashboard(SessionInterface $session): Response
    {
        if (!$this->isAuthenticated($session)) {
            return $this->redirectToRoute('fleet_login');
        }

        return $this->render('Fleet/dashboard/index.html.twig');
    }

    // ----------------------------------------------------------------
    // Trucks — see App\Controller\TruckController
    // ----------------------------------------------------------------

    // ----------------------------------------------------------------
    // Trailers
    // ----------------------------------------------------------------

    /**
     * @Route("/trailers", name="fleet_trailers")
     */
    public function trailers(SessionInterface $session): Response
    {
        if (!$this->isAuthenticated($session)) { return $this->redirectToRoute('fleet_login'); }
        return $this->render('Fleet/trailers/index.html.twig');
    }

    // ----------------------------------------------------------------
    // Loads
    // ----------------------------------------------------------------

    /**
     * @Route("/loads", name="fleet_loads")
     */
    public function loads(SessionInterface $session): Response
    {
        if (!$this->isAuthenticated($session)) { return $this->redirectToRoute('fleet_login'); }
        return $this->render('Fleet/loads/index.html.twig');
    }

    // ----------------------------------------------------------------
    // Dispatch
    // ----------------------------------------------------------------

    /**
     * @Route("/dispatch", name="fleet_dispatch")
     */
    public function dispatch(SessionInterface $session): Response
    {
        if (!$this->isAuthenticated($session)) { return $this->redirectToRoute('fleet_login'); }
        return $this->render('Fleet/dispatch/index.html.twig');
    }

    // ----------------------------------------------------------------
    // Inspections
    // ----------------------------------------------------------------

    /**
     * @Route("/inspections", name="fleet_inspections")
     */
    public function inspections(SessionInterface $session): Response
    {
        if (!$this->isAuthenticated($session)) { return $this->redirectToRoute('fleet_login'); }
        return $this->render('Fleet/inspections/index.html.twig');
    }

    // ----------------------------------------------------------------
    // Maintenance
    // ----------------------------------------------------------------

    /**
     * @Route("/maintenance", name="fleet_maintenance")
     */
    public function maintenance(SessionInterface $session): Response
    {
        if (!$this->isAuthenticated($session)) { return $this->redirectToRoute('fleet_login'); }
        return $this->render('Fleet/maintenance/index.html.twig');
    }

    // ----------------------------------------------------------------
    // Reports
    // ----------------------------------------------------------------

    /**
     * @Route("/reports", name="fleet_reports")
     */
    public function reports(SessionInterface $session): Response
    {
        if (!$this->isAuthenticated($session)) { return $this->redirectToRoute('fleet_login'); }
        return $this->render('Fleet/reports/index.html.twig');
    }

    // ----------------------------------------------------------------
    // Documents
    // ----------------------------------------------------------------

    /**
     * @Route("/documents", name="fleet_documents")
     */
    public function documents(SessionInterface $session): Response
    {
        if (!$this->isAuthenticated($session)) { return $this->redirectToRoute('fleet_login'); }
        return $this->render('Fleet/documents/index.html.twig');
    }

    // ----------------------------------------------------------------
    // Payments
    // ----------------------------------------------------------------

    /**
     * @Route("/payments", name="fleet_payments")
     */
    public function payments(SessionInterface $session): Response
    {
        if (!$this->isAuthenticated($session)) { return $this->redirectToRoute('fleet_login'); }
        return $this->render('Fleet/payments/index.html.twig');
    }

    // ----------------------------------------------------------------
    // Invoices
    // ----------------------------------------------------------------

    /**
     * @Route("/invoices", name="fleet_invoices")
     */
    public function invoices(SessionInterface $session): Response
    {
        if (!$this->isAuthenticated($session)) { return $this->redirectToRoute('fleet_login'); }
        return $this->render('Fleet/invoices/index.html.twig');
    }

    // ----------------------------------------------------------------
    // Notifications
    // ----------------------------------------------------------------

    /**
     * @Route("/notifications", name="fleet_notifications")
     */
    public function notifications(SessionInterface $session): Response
    {
        if (!$this->isAuthenticated($session)) { return $this->redirectToRoute('fleet_login'); }
        return $this->render('Fleet/notifications/index.html.twig');
    }

    // ----------------------------------------------------------------
    // Settings
    // ----------------------------------------------------------------

    /**
     * @Route("/settings", name="fleet_settings")
     */
    public function settings(SessionInterface $session): Response
    {
        if (!$this->isAuthenticated($session)) { return $this->redirectToRoute('fleet_login'); }
        return $this->render('Fleet/settings/index.html.twig');
    }

    // ----------------------------------------------------------------
    // UI Components showcase
    // ----------------------------------------------------------------

    /**
     * @Route("/components", name="fleet_components")
     */
    public function components(SessionInterface $session): Response
    {
        if (!$this->isAuthenticated($session)) { return $this->redirectToRoute('fleet_login'); }
        return $this->render('Fleet/components.html.twig');
    }
}
